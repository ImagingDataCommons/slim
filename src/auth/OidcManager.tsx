import {
  type MetadataService,
  type OidcMetadata,
  type SigninRedirectArgs,
  type User as UserData,
  UserManager,
  type UserManagerEvents,
  type UserManagerSettings,
} from 'oidc-client-ts'

import type { OidcSettings } from '../AppConfig'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'
import {
  isAuthorizationCodeInUrl,
  isOidcAuthorizeCallbackUrl,
  joinUrl,
} from '../utils/url'
import type {
  AuthManager,
  AuthorizationCallback,
  SignInCallback,
  SignInOutcome,
  User,
} from '.'
import { ImplicitGrant, type ImplicitGrantHost } from './implicitGrant'
import { createOidcStores, type OidcStores } from './oidcStore'
import {
  authorizationFromUser,
  clearAuthParamsFromUrl,
  createUser,
  currentReturnUrl,
  readReturnUrl,
} from './oidcUser'
import { installPkceFallback } from './pkce'

interface ReturnUrlState {
  returnUrl: string
}

/** The part of oidc-client-ts's `UserManager` this manager relies on */
export interface OidcUserManager extends ImplicitGrantHost {
  events: Pick<
    UserManagerEvents,
    'load' | 'addUserLoaded' | 'addAccessTokenExpiring'
  >
  metadataService: ImplicitGrantHost['metadataService'] &
    Pick<MetadataService, 'getMetadata'>
  signinRedirect: (args?: SigninRedirectArgs) => Promise<void>
  signinRedirectCallback: (url?: string) => Promise<UserData>
  signinSilent: () => Promise<UserData | null>
  signoutRedirect: () => Promise<void>
  removeUser: () => Promise<void>
  revokeTokens: () => Promise<void>
}

export interface OidcManagerOptions {
  stores?: OidcStores
  createUserManager?: (settings: UserManagerSettings) => OidcUserManager
}

const isNonEmpty = (value: string | undefined): value is string =>
  value != null && value !== ''

/** Endpoints from the configuration that take precedence over discovery */
export const buildMetadataSeed = (
  settings: OidcSettings,
): Partial<OidcMetadata> | undefined => {
  const seed: Partial<OidcMetadata> = {}
  if (isNonEmpty(settings.authorizationEndpoint)) {
    seed.authorization_endpoint = settings.authorizationEndpoint
  }
  if (isNonEmpty(settings.endSessionEndpoint)) {
    seed.end_session_endpoint = settings.endSessionEndpoint
  }
  return Object.keys(seed).length > 0 ? seed : undefined
}

const handleSignIn = (
  userData: UserData,
  onSignIn: SignInCallback | undefined,
  { includeReturnUrl }: { includeReturnUrl: boolean },
): void => {
  if (onSignIn == null) {
    console.warn('no callback function was provided to handle sign-in')
    return
  }
  console.info('handling sign-in using provided callback function')
  onSignIn({
    user: createUser(userData),
    authorization: authorizationFromUser(userData),
    returnUrl: includeReturnUrl ? readReturnUrl(userData) : undefined,
  })
}

export const buildUserManagerSettings = (
  appUri: string,
  settings: OidcSettings,
  stores: OidcStores,
): UserManagerSettings => {
  const isImplicit = settings.grantType === 'implicit'
  return {
    authority: settings.authority,
    client_id: settings.clientId,
    redirect_uri: appUri,
    /**
     * Reuse the main redirect_uri for silent renew so existing IdP client
     * registrations (app root only) keep working. The iframe path is handled
     * in index.tsx via completeSilentRenewIfFrame() before React mounts.
     */
    silent_redirect_uri: appUri,
    post_logout_redirect_uri: joinUrl('logout', appUri),
    scope: settings.scope,
    /** The implicit grant does not go through the library's request builder */
    response_type: 'code',
    metadataSeed: buildMetadataSeed(settings),
    loadUserInfo: true,
    /**
     * The library renews with the code flow, which an implicit-only client
     * cannot complete; implicit sessions are renewed by this manager instead.
     */
    automaticSilentRenew: !isImplicit,
    monitorSession: true,
    includeIdTokenInSilentRenew: true,
    /** Revoked by signOut only when the provider supports revocation */
    revokeTokensOnSignout: false,
    stateStore: stores.stateStore,
    userStore: stores.userStore,
  }
}

/**
 * Complete an OIDC silent-renew callback when this window is an iframe.
 * Returns true when the caller should skip mounting the React app.
 *
 * Must never mount the SPA inside a renew iframe: it shares sessionStorage
 * with the parent and can corrupt in-flight interactive re-auth. This includes
 * IdP error redirects such as `error=login_required` that do not carry a code.
 */
export const completeSilentRenewIfFrame = async (): Promise<boolean> => {
  if (window.parent === window) {
    return false
  }
  /** Embedded Slim (non-OIDC iframe) should still mount; only OIDC callbacks skip it. */
  if (!isOidcAuthorizeCallbackUrl(window.location)) {
    return false
  }
  try {
    /** Only posts the callback URL to the parent, which validates it */
    await new UserManager({
      authority: '',
      client_id: '',
      redirect_uri: window.location.href,
      automaticSilentRenew: false,
      ...createOidcStores(),
    }).signinSilentCallback()
  } catch (error) {
    console.error('silent renew callback failed', error)
  }
  /** Always skip SPA mount for OIDC iframe callbacks (success or error). */
  return true
}

export default class OidcManager implements AuthManager {
  private readonly _oidc: OidcUserManager
  /** Set when the configuration asks for the implicit grant */
  private readonly _implicit?: ImplicitGrant
  private readonly _authorizationListeners = new Set<AuthorizationCallback>()

  constructor(
    appUri: string,
    settings: OidcSettings,
    {
      stores = createOidcStores(),
      createUserManager = (managerSettings) => new UserManager(managerSettings),
    }: OidcManagerOptions = {},
  ) {
    this._oidc = createUserManager(
      buildUserManagerSettings(appUri, settings, stores),
    )
    this._oidc.events.addUserLoaded((userData) => {
      this._notifyAuthorization(authorizationFromUser(userData))
    })
    if (settings.grantType === 'implicit') {
      this._implicit = new ImplicitGrant(this._oidc, stores.stateStore)
      this._oidc.events.addAccessTokenExpiring(() => {
        void this.renewAuthorization()
      })
    } else {
      installPkceFallback()
    }
  }

  private _notifyAuthorization(authorization: string): void {
    for (const listener of this._authorizationListeners) {
      listener(authorization)
    }
  }

  /**
   * Sign-in to authenticate the user and obtain authorization.
   */
  signIn = async ({
    onSignIn,
    returnUrl,
  }: {
    onSignIn?: SignInCallback
    returnUrl?: string
  }): Promise<SignInOutcome> => {
    if (isAuthorizationCodeInUrl(window.location)) {
      /**
       * Handle the callback from the authorization server: extract the code
       * (or implicit tokens) from the callback URL, obtain user information
       * and the access token for the DICOMweb server.
       */
      console.info('obtaining authorization')
      const userData =
        this._implicit != null
          ? await this._implicit.signinRedirectCallback(window.location.href)
          : await this._oidc.signinRedirectCallback()
      clearAuthParamsFromUrl()
      console.info('obtained user data: ', userData)
      handleSignIn(userData, onSignIn, { includeReturnUrl: true })
      return 'completed'
    }

    /**
     * Redirect to the authorization server to authenticate the user
     * and authorize the application to obtain user information and access
     * the DICOMweb server.
     */
    const userData = await this._oidc.getUser()
    if (userData === null || userData.expired === true) {
      console.info('authenticating user')
      const state: ReturnUrlState = {
        returnUrl: returnUrl ?? currentReturnUrl(),
      }
      if (this._implicit != null) {
        await this._implicit.signinRedirect(state)
      } else {
        /** Stays pending until the page unloads (or is restored from bfcache) */
        await this._oidc.signinRedirect({ state })
      }
      return 'redirected'
    }

    console.info('user has already been authenticated')
    /** Do not re-apply persisted returnUrl on warm sessions. */
    handleSignIn(userData, onSignIn, { includeReturnUrl: false })
    return 'completed'
  }

  /**
   * Sign-out to revoke authorization.
   * Falls back to local session clear when the IdP has no end-session endpoint.
   */
  signOut = async (): Promise<void> => {
    console.log('signing out user and revoking authorization')
    const oidc = this._oidc
    const logoutUri = joinUrl('logout', oidc.settings.redirect_uri)
    try {
      const metadata = await oidc.metadataService.getMetadata()
      await this._revokeTokens(metadata)
      if (!isNonEmpty(metadata.end_session_endpoint)) {
        await oidc.removeUser()
        window.location.assign(logoutUri)
        return
      }
      await oidc.signoutRedirect()
    } catch (error) {
      console.error('sign-out redirect failed; clearing local session', error)
      await oidc.removeUser()
      window.location.assign(logoutUri)
    }
  }

  /**
   * oidc-client-ts fails the whole sign-out when revocation is unsupported or
   * rejected, so tokens are revoked here on a best-effort basis instead.
   */
  private async _revokeTokens(metadata: Partial<OidcMetadata>): Promise<void> {
    if (!isNonEmpty(metadata.revocation_endpoint)) {
      return
    }
    try {
      await this._oidc.revokeTokens()
    } catch (error) {
      console.warn('token revocation failed', error)
    }
  }

  /**
   * Get authorization. Requires prior sign-in.
   * Returns a full HTTP Authorization header value (e.g. "Bearer …").
   */
  getAuthorization = async (): Promise<string | undefined> => {
    const userData = await this._oidc.getUser()
    if (userData !== null && userData.expired !== true) {
      return authorizationFromUser(userData)
    }
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.AUTH,
      new CustomError(
        errorTypes.AUTHENTICATION,
        'Failed to obtain user profile.',
      ),
    )
    return undefined
  }

  /**
   * Get user information. Requires prior sign-in.
   */
  getUser = async (): Promise<User> => {
    const userData = await this._oidc.getUser()
    if (userData === null) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.AUTH,
        new CustomError(
          errorTypes.AUTHENTICATION,
          'Failed to obtain user information.',
        ),
      )
    }
    return createUser(userData)
  }

  renewAuthorization = async (): Promise<string | undefined> => {
    try {
      const userData =
        this._implicit != null
          ? await this._implicit.signinSilent()
          : await this._oidc.signinSilent()
      if (userData == null || userData.expired === true) {
        return undefined
      }
      const authorization = authorizationFromUser(userData)
      this._notifyAuthorization(authorization)
      return authorization
    } catch (error) {
      console.warn('silent authorization renew failed', error)
      return undefined
    }
  }

  onAuthorizationChange = (callback: AuthorizationCallback): (() => void) => {
    this._authorizationListeners.add(callback)
    return () => {
      this._authorizationListeners.delete(callback)
    }
  }
}

import {
  type User as UserData,
  UserManager,
  type UserManagerSettings,
} from 'oidc-client-ts'

import type { OidcSettings } from '../AppConfig'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'
import { isAuthorizationCodeInUrl, joinUrl } from '../utils/url'
import type {
  AuthManager,
  AuthorizationCallback,
  SignInCallback,
  User,
} from '.'

interface ReturnUrlState {
  returnUrl?: string
}

const createUser = (userData: UserData | null): User => {
  let profile: UserData['profile'] | undefined
  if (userData !== null) {
    profile = userData.profile
  }

  if (profile !== undefined) {
    if (profile.name === undefined || profile.email === undefined) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.AUTH,
        new CustomError(
          errorTypes.AUTHENTICATION,
          'Failed to obtain user "name" and "email".',
        ),
      )
    } else {
      return {
        name: profile.name,
        email: profile.email,
      }
    }
  } else {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.AUTH,
      new CustomError(
        errorTypes.AUTHENTICATION,
        'Failed to obtain user profile.',
      ),
    )
  }
  return {
    name: undefined,
    email: undefined,
  }
}

const authorizationFromUser = (userData: UserData): string => {
  const tokenType = userData.token_type || 'Bearer'
  return `${tokenType} ${userData.access_token}`
}

const clearAuthParamsFromUrl = (): void => {
  const url = new URL(window.location.href)
  const authParams = [
    'code',
    'state',
    'session_state',
    'iss',
    'id_token',
    'access_token',
    'token_type',
    'expires_in',
    'scope',
    'error',
    'error_description',
  ]
  for (const key of authParams) {
    url.searchParams.delete(key)
  }
  // Implicit / hybrid responses put tokens in the hash fragment.
  url.hash = ''
  const cleaned = `${url.pathname}${url.search}`
  window.history.replaceState({}, document.title, cleaned)
}

const readReturnUrl = (userData: UserData): string | undefined => {
  const state = userData.state as ReturnUrlState | string | null | undefined
  if (state == null) {
    return undefined
  }
  if (typeof state === 'string') {
    return state || undefined
  }
  if (typeof state.returnUrl === 'string' && state.returnUrl !== '') {
    return state.returnUrl
  }
  return undefined
}

const currentReturnUrl = (): string => {
  return `${window.location.pathname}${window.location.search}`
}

export default class OidcManager implements AuthManager {
  private _oidc: UserManager
  private readonly _ready: Promise<void>
  private readonly _authorizationListeners = new Set<AuthorizationCallback>()

  constructor(appUri: string, settings: OidcSettings) {
    const isImplicit = settings.grantType === 'implicit'
    const responseType = isImplicit ? 'id_token token' : 'code'
    const redirectUri = appUri
    const silentRedirectUri = joinUrl('silent-renew.html', appUri)
    const postLogoutRedirectUri = joinUrl('logout', appUri)

    const baseSettings: UserManagerSettings = {
      authority: settings.authority,
      client_id: settings.clientId,
      redirect_uri: redirectUri,
      silent_redirect_uri: silentRedirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      scope: settings.scope,
      response_type: responseType,
      loadUserInfo: true,
      automaticSilentRenew: true,
      revokeTokensOnSignout: true,
    }

    // PKCE is the oidc-client-ts default for code flow; leave it enabled.
    // Implicit grant does not use PKCE.
    this._oidc = new UserManager(baseSettings)
    this._wireInternalEvents()
    this._ready = this._applyOptionalMetadata(baseSettings, settings)
  }

  private _wireInternalEvents(): void {
    this._oidc.events.addUserLoaded((userData) => {
      this._notifyAuthorization(authorizationFromUser(userData))
    })
  }

  private _notifyAuthorization(authorization: string): void {
    for (const listener of this._authorizationListeners) {
      listener(authorization)
    }
  }

  private async _applyOptionalMetadata(
    baseSettings: UserManagerSettings,
    settings: OidcSettings,
  ): Promise<void> {
    const needsMetadataPatch =
      (settings.endSessionEndpoint != null &&
        settings.endSessionEndpoint !== '') ||
      (settings.authorizationEndpoint != null &&
        settings.authorizationEndpoint !== '')

    if (!needsMetadataPatch) {
      return
    }

    try {
      const metadata = await this._oidc.metadataService.getMetadata()
      if (
        settings.endSessionEndpoint != null &&
        settings.endSessionEndpoint !== ''
      ) {
        metadata.end_session_endpoint = settings.endSessionEndpoint
      }
      if (
        settings.authorizationEndpoint != null &&
        settings.authorizationEndpoint !== ''
      ) {
        metadata.authorization_endpoint = settings.authorizationEndpoint
      }
      this._oidc = new UserManager({
        ...baseSettings,
        metadata,
      })
      this._wireInternalEvents()
    } catch (error) {
      console.error('failed to get metadata from authorization server: ', error)
    }
  }

  private async _ensureReady(): Promise<UserManager> {
    await this._ready
    return this._oidc
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
  }): Promise<void> => {
    const oidc = await this._ensureReady()

    const handleSignIn = (userData: UserData): void => {
      const user = createUser(userData)
      const authorization = authorizationFromUser(userData)
      const resolvedReturnUrl = readReturnUrl(userData)
      if (onSignIn != null) {
        console.info('handling sign-in using provided callback function')
        onSignIn({
          user,
          authorization,
          returnUrl: resolvedReturnUrl,
        })
      } else {
        console.warn('no callback function was provided to handle sign-in')
      }
    }

    if (isAuthorizationCodeInUrl(window.location)) {
      /* Handle the callback from the authorization server: extract the code
       * (or implicit tokens) from the callback URL, obtain user information
       * and the access token for the DICOMweb server.
       */
      console.info('obtaining authorization')
      const userData = await oidc.signinRedirectCallback()
      clearAuthParamsFromUrl()
      console.info('obtained user data: ', userData)
      handleSignIn(userData)
    } else {
      /* Redirect to the authorization server to authenticate the user
       * and authorize the application to obtain user information and access
       * the DICOMweb server.
       */
      const userData = await oidc.getUser()
      if (userData === null || userData === undefined || userData.expired) {
        console.info('authenticating user')
        await oidc.signinRedirect({
          state: {
            returnUrl: returnUrl ?? currentReturnUrl(),
          },
        })
      } else {
        console.info('user has already been authenticated')
        handleSignIn(userData)
      }
    }
  }

  /**
   * Sign-out to revoke authorization.
   * Falls back to local session clear when the IdP has no end-session endpoint.
   */
  signOut = async (): Promise<void> => {
    console.log('signing out user and revoking authorization')
    const oidc = await this._ensureReady()
    try {
      const metadata = await oidc.metadataService.getMetadata()
      if (
        metadata.end_session_endpoint == null ||
        metadata.end_session_endpoint === ''
      ) {
        await oidc.removeUser()
        window.location.assign(joinUrl('logout', oidc.settings.redirect_uri))
        return
      }
      await oidc.signoutRedirect()
    } catch (error) {
      console.error('sign-out redirect failed; clearing local session', error)
      await oidc.removeUser()
      window.location.assign(joinUrl('logout', oidc.settings.redirect_uri))
    }
  }

  /**
   * Get authorization. Requires prior sign-in.
   * Returns a full HTTP Authorization header value (e.g. "Bearer …").
   */
  getAuthorization = async (): Promise<string | undefined> => {
    const oidc = await this._ensureReady()
    const userData = await oidc.getUser()
    if (userData !== null && userData !== undefined && !userData.expired) {
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
    const oidc = await this._ensureReady()
    const userData = await oidc.getUser()
    if (userData === null || userData === undefined) {
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
    const oidc = await this._ensureReady()
    try {
      const userData = await oidc.signinSilent()
      if (userData == null || userData.expired) {
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

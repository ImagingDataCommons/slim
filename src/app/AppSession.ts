import type AppConfig from '../AppConfig'
import type {
  DicomWebManagerErrorHandler,
  ErrorMessageSettings,
  OidcSettings,
} from '../AppConfig'
import type { AuthManager, SignInCallback, User } from '../auth'
import OidcManager from '../auth/OidcManager'
import {
  clearCachedOidcConfig,
  readCachedOidcConfig,
  resetCachedOidcConfigFromUrl,
} from '../auth/oidcConfig'
import type { AuthorizationPolicy } from '../DicomWebManager'
import DicomWebManager from '../DicomWebManager'
import type { ServerSelectionParams } from '../features/header'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'
import {
  getLocalStorage,
  readStorage,
  writeStorage,
} from '../utils/safeStorage'
import {
  loadServerSelection,
  SERVER_MODE_STORAGE_KEY,
  SERVER_URL_STORAGE_KEY,
} from '../utils/serverSelectionStorage'
import { joinUrl } from '../utils/url'
import {
  addGcpSecondaryAnnotationServer,
  applyAuthorizationPolicy,
  type ClientMapping,
  collectConfiguredOrigins,
  createClientMapping,
  DEFAULT_GCP_BASE_URL,
  mapAllStorageClasses,
  resolveCustomServerUrl,
  updateAuthorization,
} from './clientMapping'
import { confirmAuthorizationDisclosure } from './confirmAuthorizationDisclosure'
import {
  createTokenDisclosurePolicy,
  type TokenDisclosureOptions,
} from './tokenDisclosure'

export interface AppSessionState {
  clients: ClientMapping
  defaultClients: ClientMapping
  user?: User
  isLoading: boolean
  wasAuthSuccessful: boolean
  signInFailureMessage?: string
  error?: ErrorMessageSettings
  /** Bumped after mid-session auth recovery so views remount and refetch. */
  authRecoveryKey: number
}

export interface AppSessionOptions {
  config: AppConfig
  createAuth?: (appUri: string, settings: OidcSettings) => AuthManager
  confirmDisclosure?: TokenDisclosureOptions['confirm']
  reload?: () => void
}

type StateUpdate =
  | Partial<AppSessionState>
  | ((state: AppSessionState) => Partial<AppSessionState>)

const SIGN_IN_FAILED_WITH_CACHED_CONFIG =
  'Sign-in with the custom OIDC configuration failed. It has been cleared; reload the page to use the default configuration.'

/**
 * Sign-in, DICOMweb clients and server selection for the app, as an external
 * store the React tree subscribes to. Constructing it has side effects (URL
 * cleanup, an OIDC manager with its own timers, `?gcp=` appended to the
 * configured servers), so it is created once per configuration rather than
 * during render.
 */
export class AppSession {
  readonly auth?: AuthManager
  /** Whether `auth` was built from the OIDC config cached by server selection */
  private usesCachedOidcConfig = false
  /** Issuer of the tokens `auth` hands out */
  private readonly oidcAuthority?: string
  private reauthInProgress = false
  private hasStarted = false
  private unsubscribeAuthorization?: () => void
  private readonly authorizationPolicy: AuthorizationPolicy
  private readonly reload: () => void
  private readonly listeners = new Set<() => void>()
  private state: AppSessionState

  constructor({
    config,
    createAuth = (appUri, settings) => new OidcManager(appUri, settings),
    confirmDisclosure = confirmAuthorizationDisclosure,
    reload = () => window.location.reload(),
  }: AppSessionOptions) {
    this.reload = reload

    if (import.meta.env.MODE === 'development') {
      console.info('instatiate app')
      console.info(`app is located at "${config.path}"`)
    }

    const { protocol, host } = window.location
    const baseUri = `${protocol}//${host}`
    const appUri = joinUrl(config.path, baseUri)

    resetCachedOidcConfigFromUrl()
    /** OIDC config entered in server selection overrides the deployment one */
    const cachedOidcSettings = readCachedOidcConfig()
    this.usesCachedOidcConfig = cachedOidcSettings !== undefined
    const oidcSettings = cachedOidcSettings ?? config.oidc
    if (oidcSettings !== undefined) {
      if (import.meta.env.MODE === 'development') {
        console.info(
          'app uses the following OIDC configuration: ',
          oidcSettings,
        )
      }
      this.auth = createAuth(appUri, oidcSettings)
      this.oidcAuthority = oidcSettings.authority
    }

    if (config.servers.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.COMMUNICATION,
          'One server needs to be configured.',
        ),
      )
    }

    if (import.meta.env.MODE === 'development') {
      console.info(
        'app uses the following DICOMweb server configuration: ',
        config.servers,
      )
    }

    /**
     * Hold the servers that came from the configuration file, before `?gcp=`
     * appends a runtime, URL-supplied one. These are references, not copies:
     * `createClientMapping` rewrites `url` in place on `/projects/` routes, so
     * the origins are read afterwards to capture the effective value.
     */
    const configuredServers = [...config.servers]
    addGcpSecondaryAnnotationServer(config, window.location.search)

    const defaultClients = createClientMapping({
      baseUri,
      gcpBaseUrl: config.gcpBaseUrl ?? DEFAULT_GCP_BASE_URL,
      settings: config.servers,
      pathname: window.location.pathname,
      onError: this.handleDicomWebError,
    })

    this.authorizationPolicy = createTokenDisclosurePolicy({
      auth: this.auth,
      configuredOrigins: collectConfiguredOrigins(configuredServers, baseUri),
      oidcAuthority: this.oidcAuthority,
      confirm: confirmDisclosure,
      onAuthorization: (authorization) => {
        this.applyAuthorization(authorization)
      },
    })
    applyAuthorizationPolicy(defaultClients, this.authorizationPolicy)

    this.state = {
      clients: defaultClients,
      defaultClients,
      isLoading: true,
      wasAuthSuccessful: false,
      authRecoveryKey: 0,
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): AppSessionState => this.state

  private update(update: StateUpdate): void {
    const patch = typeof update === 'function' ? update(this.state) : update
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) {
      listener()
    }
  }

  /**
   * Connect to the identity provider once the app has mounted. Sign-in and
   * the cached server selection run only on the first call, so a remount does
   * not restart them; the returned cleanup only detaches token updates.
   */
  start = (): (() => void) => {
    const isFirstStart = !this.hasStarted
    this.hasStarted = true

    if (isFirstStart) {
      const cachedSelection = loadServerSelection(getLocalStorage())
      if (cachedSelection.mode === 'custom') {
        void this.selectServer({ url: cachedSelection.url })
      }
    }

    if (this.auth != null && this.unsubscribeAuthorization === undefined) {
      this.unsubscribeAuthorization = this.auth.onAuthorizationChange(
        (authorization) => {
          this.applyAuthorization(authorization)
        },
      )
    }

    if (isFirstStart) {
      this.signIn()
    }

    return () => {
      this.unsubscribeAuthorization?.()
      this.unsubscribeAuthorization = undefined
    }
  }

  readonly handleDicomWebError: DicomWebManagerErrorHandler = (
    error,
    serverSettings,
  ) => {
    if (error.status === 401) {
      void this.ensureAuthorized()
    } else if (error.status === 403) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.DICOMWEB,
        new CustomError(
          errorTypes.COMMUNICATION,
          'User is not authorized to access DICOMweb resources.',
        ),
      )
    }

    const logServerError = (): void => {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.DICOMWEB,
        new CustomError(
          errorTypes.COMMUNICATION,
          'An unexpected server error occured.',
        ),
      )
    }

    if (serverSettings.errorMessages !== undefined) {
      serverSettings.errorMessages.forEach((setting: ErrorMessageSettings) => {
        if (error.status === setting.status) {
          this.update({
            error: {
              status: error.status,
              message: setting.message,
            },
          })
        } else if (error.status === 500) {
          logServerError()
        }
      })
    } else if (error.status === 500) {
      logServerError()
    }
  }

  selectServer = async ({
    url,
    oidc,
  }: ServerSelectionParams): Promise<void> => {
    const trimmedUrl = url.trim()
    console.info('select DICOMweb server: ', trimmedUrl)

    const resolvedUrl = resolveCustomServerUrl(
      trimmedUrl,
      readStorage(SERVER_MODE_STORAGE_KEY),
    )
    if (resolvedUrl !== undefined) {
      writeStorage(SERVER_URL_STORAGE_KEY, resolvedUrl)
    }

    if (oidc !== undefined) {
      /**
       * Start over with the cached config, which the constructor reads and
       * mount signs in with. Clients keep token grants and headers from the
       * previous provider in memory, and the deployment may have no OIDC.
       */
      console.info(
        oidc === null
          ? 'removing custom OIDC configuration'
          : 'applying custom OIDC configuration',
      )
      this.reload()
      return
    }

    if (resolvedUrl === undefined) {
      this.update((state) => ({ clients: state.defaultClients }))
      return
    }
    const tmpClient = new DicomWebManager({
      baseUri: '',
      settings: [
        {
          id: 'tmp',
          url: resolvedUrl,
          read: true,
          write: false,
        },
      ],
      onError: this.handleDicomWebError,
    })
    tmpClient.setAuthorizationPolicy(this.authorizationPolicy)
    /**
     * Carry over non-credential headers only. The token is deliberately not
     * forwarded here: this URL was typed by the user and has not been vetted by
     * anyone. If the server actually needs credentials it will answer 401, and
     * the authorization policy will ask before anything is disclosed.
     */
    const { Authorization: _omitted, ...inheritedHeaders } =
      this.state.clients.default.headers
    tmpClient.updateHeaders(inheritedHeaders)
    if (this.auth != null && this.state.user != null) {
      const authorization = await this.auth.getAuthorization()
      if (authorization != null) {
        /**
         * Offered, not forced: `updateHeaders` attaches it only if this origin
         * has already been approved.
         */
        tmpClient.updateHeaders({ Authorization: authorization })
      }
    }
    this.update((state) => ({
      clients: mapAllStorageClasses(state.clients, tmpClient),
    }))
  }

  private applyAuthorization(authorization: string): void {
    updateAuthorization(this.state.clients, authorization)
    updateAuthorization(this.state.defaultClients, authorization)
  }

  /**
   * Handle successful authentication event.
   *
   * Authorizes the DICOMweb client to access the DICOMweb server and directs
   * the user back to the pre-login route (via OIDC state).
   */
  private readonly handleSignIn: SignInCallback = ({
    user,
    authorization,
    returnUrl,
  }) => {
    this.applyAuthorization(authorization)
    this.update({ user })

    if (returnUrl != null && returnUrl !== '') {
      const current = `${window.location.pathname}${window.location.search}`
      if (returnUrl !== current) {
        window.location.assign(returnUrl)
      }
    }
  }

  /**
   * Recover from an expired/missing access token without losing the route.
   * Tries silent renew first; falls back to interactive redirect with returnUrl.
   */
  ensureAuthorized = async (): Promise<void> => {
    if (this.auth == null || this.reauthInProgress) {
      return
    }
    this.reauthInProgress = true
    let redirectedToIdp = false
    try {
      const authorization = await this.auth.renewAuthorization()
      if (authorization != null) {
        this.applyAuthorization(authorization)
        /** Remount routed views so in-flight 401 failures refetch with the new token. */
        this.update((state) => ({
          authRecoveryKey: state.authRecoveryKey + 1,
        }))
        return
      }
      console.info('silent renew unavailable; starting interactive sign-in')
      const outcome = await this.auth.signIn({
        onSignIn: this.handleSignIn,
        returnUrl: `${window.location.pathname}${window.location.search}`,
      })
      redirectedToIdp = outcome === 'redirected'
      if (outcome === 'completed') {
        /** Token was refreshed without leaving the page; remount views to refetch. */
        this.update((state) => ({
          authRecoveryKey: state.authRecoveryKey + 1,
        }))
      }
    } catch (error) {
      console.error(error)
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.AUTH,
        new CustomError(
          errorTypes.AUTHENTICATION,
          'Could not renew authorization.',
        ),
      )
    } finally {
      /**
       * Once the page is navigating to the IdP, signIn either resolves right
       * away or (oidc-client-ts) stays pending until unload. Keep the guard set
       * until unload so concurrent 401s cannot start another redirect.
       */
      if (!redirectedToIdp) {
        this.reauthInProgress = false
      }
    }
  }

  private signIn(): void {
    if (this.auth === undefined) {
      this.update({
        isLoading: false,
        wasAuthSuccessful: true,
      })
      return
    }
    console.info('try to sign in user')
    this.auth
      .signIn({
        onSignIn: this.handleSignIn,
        returnUrl: `${window.location.pathname}${window.location.search}`,
      })
      .then((outcome) => {
        if (outcome === 'redirected') {
          return
        }
        console.info('sign-in was successful')
        this.update({
          isLoading: false,
          wasAuthSuccessful: true,
        })
      })
      .catch((error: unknown) => {
        console.error(error)
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.AUTH,
          new CustomError(errorTypes.AUTHENTICATION, 'Could not sign-in user.'),
        )
        /**
         * The failure page has no header, so a broken custom config could
         * not be changed from the UI and would be reused on every load.
         */
        let signInFailureMessage: string | undefined
        if (this.usesCachedOidcConfig) {
          clearCachedOidcConfig()
          this.usesCachedOidcConfig = false
          signInFailureMessage = SIGN_IN_FAILED_WITH_CACHED_CONFIG
        }
        this.update({
          isLoading: false,
          wasAuthSuccessful: false,
          signInFailureMessage,
        })
      })
  }

  /** Sign out with the identity provider; a no-op without OIDC */
  signOut = (): void => {
    void this.auth?.signOut()
  }
}

// skipcq: JS-C1003
import type * as dwc from 'dicomweb-client'
import React from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from 'react-router-dom'

import type AppConfig from './AppConfig'
import type {
  ErrorMessageSettings,
  OidcSettings,
  ServerSettings,
} from './AppConfig'
import type { AuthManager, User } from './auth'
import OidcManager from './auth/OidcManager'
import {
  clearCachedOidcConfig,
  readCachedOidcConfig,
  resetCachedOidcConfigFromUrl,
} from './auth/oidcConfig'
import AppLoading from './components/AppLoading'
import AppShell from './components/AppShell'
import CaseViewer from './components/CaseViewer'
import { showConfirmDialog } from './components/ConfirmDialog'
import InfoPage from './components/InfoPage'
import { ValidationProvider } from './contexts/ValidationContext'
import type { AuthorizationPolicy } from './DicomWebManager'
import DicomWebManager from './DicomWebManager'
import { StorageClasses } from './data/uids'
import { Header } from './features/header'
import { Worklist } from './features/worklist'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from './services/NotificationMiddleware'
import {
  getOrigin,
  isSecureOrigin,
  readAuthorizationDecision,
  writeAuthorizationDecision,
} from './utils/authPolicy'
import { CustomError, errorTypes } from './utils/CustomError'
import { getProjectStorePath, isProjectsPath, RoutePaths } from './utils/routes'
import { getLocalStorage, readStorage, writeStorage } from './utils/safeStorage'
import {
  loadServerSelection,
  SERVER_MODE_STORAGE_KEY,
  SERVER_URL_STORAGE_KEY,
} from './utils/serverSelectionStorage'
import { createSingleFlight } from './utils/singleFlight'
import { joinUrl, normalizeServerUrl } from './utils/url'

function ParametrizedCaseViewer({
  clients,
  user,
  app,
  config,
}: {
  clients: { [key: string]: DicomWebManager }
  user?: User
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
  config: AppConfig
}): JSX.Element {
  const { studyInstanceUID } = useParams()

  if (studyInstanceUID === undefined) {
    return <Navigate to="/" replace />
  }

  const enableAnnotationTools = !(config.disableAnnotationTools ?? false)
  const preload = config.preload ?? false
  return (
    <ValidationProvider clients={clients} studyInstanceUID={studyInstanceUID}>
      <CaseViewer
        clients={clients}
        user={user}
        annotations={config.annotations}
        preload={preload}
        app={app}
        enableAnnotationTools={enableAnnotationTools}
        enableMemoryMonitoring={config.enableMemoryMonitoring ?? true}
        studyInstanceUID={studyInstanceUID}
      />
    </ValidationProvider>
  )
}

function _createClientMapping({
  baseUri,
  gcpBaseUrl,
  settings,
  onError,
}: {
  baseUri: string
  gcpBaseUrl: string
  settings: ServerSettings[]
  onError: (
    error: dwc.api.DICOMwebClientError,
    serverSettings: ServerSettings,
  ) => void
}): { [sopClassUID: string]: DicomWebManager } {
  const storageClassMapping: { [key: string]: number } = { default: 0 }
  const clientMapping: { [sopClassUID: string]: DicomWebManager } = {}

  const defaultServers: ServerSettings[] = []

  settings.forEach((serverSettings) => {
    if (serverSettings.storageClasses != null) {
      serverSettings.storageClasses.forEach((sopClassUID) => {
        if (Object.values<string>(StorageClasses).includes(sopClassUID)) {
          if (sopClassUID in storageClassMapping) {
            storageClassMapping[sopClassUID] += 1
          } else {
            storageClassMapping[sopClassUID] = 1
          }
        } else {
          console.warn(
            `unknown storage class "${sopClassUID}" specified ` +
              `for configured server "${serverSettings.id}"`,
          )
        }
      })
    } else {
      if (isProjectsPath(window.location.pathname)) {
        const pathname = getProjectStorePath(window.location.pathname)
        const pathUrl = `${gcpBaseUrl}${pathname}/dicomWeb`
        serverSettings.url = pathUrl
      }

      storageClassMapping.default += 1
      defaultServers.push(serverSettings)
      clientMapping.default = new DicomWebManager({
        baseUri,
        settings: [serverSettings],
        onError,
      })
    }
  })

  if (storageClassMapping.default > 1) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(
        errorTypes.COMMUNICATION,
        'Only one default server can be configured without specification ' +
          'of storage classes.',
      ),
    )
  }

  /**
   * For each storage class explicitly assigned to a non-default server, wrap
   * BOTH the default server and the specialty server(s) in the same manager.
   *
   * This makes derived data (SR/SEG/ANN/PM/PR) load from the primary store
   * AND the secondary `gcp=` URL store at the same time (GH-320). Without
   * this, specifying `gcp=` previously caused the default store to be
   * skipped for those classes and SLIM only saw the secondary's derived data.
   */
  if (Object.keys(storageClassMapping).length > 1) {
    const classToServers = new Map<string, ServerSettings[]>()
    settings.forEach((server) => {
      if (server.storageClasses != null) {
        server.storageClasses.forEach((sopClassUID) => {
          const list = classToServers.get(sopClassUID) ?? []
          list.push(server)
          classToServers.set(sopClassUID, list)
        })
      }
    })

    classToServers.forEach((specialtyServers, sopClassUID) => {
      const combinedServers = [...defaultServers, ...specialtyServers]
      clientMapping[sopClassUID] = new DicomWebManager({
        baseUri,
        settings: combinedServers,
        onError,
      })
    })
  }

  Object.values(StorageClasses).forEach((sopClassUID) => {
    if (!(sopClassUID in clientMapping)) {
      clientMapping[sopClassUID] = clientMapping.default
    }
  })
  return clientMapping
}

interface AppProps {
  name: string
  homepage: string
  version: string
  config: AppConfig
}

interface AppState {
  clients: { [sopClassUID: string]: DicomWebManager }
  defaultClients: { [sopClassUID: string]: DicomWebManager }
  user?: User
  isLoading: boolean
  redirectTo?: string
  wasAuthSuccessful: boolean
  signInFailureMessage?: string
  error?: ErrorMessageSettings
  /** Bumped after mid-session auth recovery so views remount and refetch. */
  authRecoveryKey: number
}

class App extends React.Component<AppProps, AppState> {
  private readonly auth?: AuthManager
  /** Whether `auth` was built from the OIDC config cached by server selection */
  private usesCachedOidcConfig = false
  /** Issuer of the tokens `auth` hands out */
  private readonly oidcAuthority?: string
  private reauthInProgress = false
  private unsubscribeAuthorization?: () => void

  /**
   * Origins that came from the deployed configuration file. Putting a server
   * there is the operator stating they trust it, so a 401 from one of these
   * escalates without troubling the user. Servers introduced at runtime — the
   * "Select server" dialog, the `?gcp=` parameter — are not on this list and
   * require explicit consent before the token is sent.
   */
  private readonly configuredOrigins: Set<string>

  /**
   * Collapses consent negotiations by origin, so simultaneous challenges from
   * different managers share a single prompt.
   */
  private readonly disclosureGate = createSingleFlight<string | undefined>()

  private readonly handleDICOMwebError = (
    error: dwc.api.DICOMwebClientError,
    serverSettings: ServerSettings,
  ): void => {
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
          this.setState({
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

  constructor(props: AppProps) {
    super(props)

    if (process.env.NODE_ENV === 'development') {
      console.info('instatiate app')
      console.info(`app is located at "${props.config.path}"`)
    }

    const { protocol, host } = window.location
    const baseUri = `${protocol}//${host}`
    const appUri = joinUrl(props.config.path, baseUri)

    resetCachedOidcConfigFromUrl()
    /** OIDC config entered in server selection overrides the deployment one */
    const cachedOidcSettings = readCachedOidcConfig()
    this.usesCachedOidcConfig = cachedOidcSettings !== undefined
    const oidcSettings = cachedOidcSettings ?? props.config.oidc
    if (oidcSettings !== undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          'app uses the following OIDC configuration: ',
          oidcSettings,
        )
      }
      this.auth = new OidcManager(appUri, oidcSettings)
      this.oidcAuthority = oidcSettings.authority
    }

    if (props.config.servers.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.COMMUNICATION,
          'One server needs to be configured.',
        ),
      )
    }

    if (process.env.NODE_ENV === 'development') {
      console.info(
        'app uses the following DICOMweb server configuration: ',
        props.config.servers,
      )
    }

    /**
     * Hold the servers that came from the configuration file, before `?gcp=`
     * appends a runtime, URL-supplied one. These are references, not copies:
     * `_createClientMapping` rewrites `url` in place on `/projects/` routes, so
     * the origins are read afterwards to capture the effective value.
     */
    const configuredServers = [...props.config.servers]
    App.addGcpSecondaryAnnotationServer(props.config)

    const defaultClients = _createClientMapping({
      baseUri,
      gcpBaseUrl:
        props.config.gcpBaseUrl ?? 'https://healthcare.googleapis.com/v1',
      settings: props.config.servers,
      onError: this.handleDICOMwebError,
    })

    this.configuredOrigins = new Set(
      configuredServers
        .map((server) => (server.url != null ? getOrigin(server.url) : baseUri))
        .filter((origin): origin is string => origin !== undefined),
    )
    this.applyAuthorizationPolicy(defaultClients)

    this.state = {
      clients: defaultClients,
      defaultClients,
      isLoading: true,
      wasAuthSuccessful: false,
      authRecoveryKey: 0,
    }
  }

  static addGcpSecondaryAnnotationServer(config: AppProps['config']): void {
    const serverId = 'gcp_secondary_annotation_server'
    const urlParams = new URLSearchParams(window.location.search)
    const url = urlParams.get('gcp')
    const gcpSecondaryAnnotationServer = config.servers.find(
      (server) => server.id === serverId,
    )
    if (gcpSecondaryAnnotationServer === undefined && typeof url === 'string') {
      config.servers.push({
        id: serverId,
        write: true,
        url,
        storageClasses: [
          StorageClasses.COMPREHENSIVE_SR,
          StorageClasses.COMPREHENSIVE_3D_SR,
          StorageClasses.SEGMENTATION,
          StorageClasses.LABELMAP_SEGMENTATION,
          StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION,
          StorageClasses.PARAMETRIC_MAP,
          StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE,
          StorageClasses.COLOR_SOFTCOPY_PRESENTATION_STATE,
          StorageClasses.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE,
          StorageClasses.PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE,
        ],
      })
    }
  }

  /**
   * Policy handed to every DicomWebManager: it decides which origins may
   * receive the user's access token.
   *
   * Slim sends no token until a server answers 401/403. At that point an origin
   * from the configuration file is credentialed silently, while any other
   * origin needs the user to say yes — otherwise a server could obtain a live
   * cloud credential just by claiming to want one.
   */
  private readonly authorizationPolicy: AuthorizationPolicy = {
    isPreAuthorized: (origin: string): boolean =>
      readAuthorizationDecision(origin) === 'granted',

    /**
     * Collapsed per origin across the whole app. Each DicomWebManager already
     * dedupes its own concurrent challenges, but a storage class gets its own
     * manager, so a single page load can challenge one server from several of
     * them at once. Without this the user is asked once per manager.
     */
    requestAuthorization: async (origin: string): Promise<string | undefined> =>
      await this.disclosureGate(
        origin,
        async () => await this.negotiateDisclosure(origin),
      ),
  }

  /**
   * Decide whether the access token may be disclosed to an origin, prompting
   * the user when the origin is not part of the deployed configuration, and
   * return the token if so.
   *
   * Always call this through `authorizationPolicy.requestAuthorization`, which
   * collapses concurrent callers onto one negotiation — this method itself will
   * open a dialog every time it is invoked.
   *
   * @param origin - Origin of the server that asked for credentials
   * @returns The token to send, or undefined if it must be withheld
   */
  private readonly negotiateDisclosure = async (
    origin: string,
  ): Promise<string | undefined> => {
    try {
      if (this.auth == null) {
        return undefined
      }
      if (!isSecureOrigin(origin)) {
        /**
         * Refuse rather than warn. A bearer token sent over plain HTTP is
         * readable by anything on the path, and no consent dialog makes that
         * safe. An operator who has a reason to do it anyway can still say so
         * explicitly with `sendAuthorization: true`, which never reaches here.
         */
        console.warn(
          `refusing to send access token to ${origin} over an insecure ` +
            'connection; set sendAuthorization on the server configuration ' +
            'to override',
        )
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.AUTH,
          new CustomError(
            errorTypes.AUTHENTICATION,
            `Not sending your access token to ${origin}: the connection is ` +
              'not secure.',
          ),
        )
        return undefined
      }
      const remembered = readAuthorizationDecision(origin)
      if (remembered === 'denied') {
        return undefined
      }
      if (remembered !== 'granted' && !this.configuredOrigins.has(origin)) {
        const approved = await App.confirmAuthorizationDisclosure(
          origin,
          this.oidcAuthority,
        )
        writeAuthorizationDecision(origin, approved ? 'granted' : 'denied')
        console.info(
          `${approved ? 'approved' : 'declined'} disclosure of access token ` +
            `to ${origin} (user decision)`,
        )
        if (!approved) {
          return undefined
        }
      } else {
        writeAuthorizationDecision(origin, 'granted')
        console.info(
          `approved disclosure of access token to ${origin} ` +
            '(origin present in the deployed configuration)',
        )
      }

      const authorization = await this.auth.getAuthorization()
      if (authorization == null) {
        return undefined
      }
      /**
       * The grant is recorded per origin, but each storage class has its own
       * manager. Push the token across all of them so stores on this origin in
       * a sibling manager are credentialed now, rather than each having to be
       * refused once before it asks. Every manager re-applies its own per-store
       * filtering, so this cannot widen disclosure beyond the recorded grants.
       */
      this.applyAuthorization(authorization)
      return authorization
    } catch (error) {
      /**
       * Never let a failed negotiation reject: callers are inside a DICOMweb
       * error path already, and a rejection here would replace the underlying
       * server error with a less useful one.
       */
      console.error('could not negotiate token disclosure', error)
      return undefined
    }
  }

  /**
   * Ask the user before disclosing their access token to a server that is not
   * part of the deployed configuration.
   *
   * Names the identity provider that issued the token, since "your access
   * token" alone does not tell the user what is actually at stake — the answer
   * differs a great deal between a hospital SSO and a personal Google account.
   *
   * @param origin - Origin of the server that asked for credentials
   * @param authority - Issuer of the token, from the OIDC configuration
   * @returns Whether the user agreed to disclose the token
   */
  private static async confirmAuthorizationDisclosure(
    origin: string,
    authority?: string,
  ): Promise<boolean> {
    return await showConfirmDialog({
      title: 'Send your access token to this server?',
      description: (
        <div className="space-y-3 text-sm">
          <p>
            <strong className="font-semibold">{origin}</strong> refused an
            anonymous request and is asking you to sign in.
          </p>
          <p>
            Slim can forward the access token issued to you by{' '}
            <strong className="font-semibold">
              {authority ?? 'your identity provider'}
            </strong>{' '}
            so this server can identify you. Anyone holding that token can act
            as you against that provider for as long as it remains valid.
          </p>
          <p>Only allow this if you trust {origin}.</p>
        </div>
      ),
      confirmLabel: 'Send token',
      cancelLabel: "Don't send",
    })
  }

  /** Install the authorization policy on every distinct manager in a mapping. */
  private applyAuthorizationPolicy(clients: {
    [key: string]: DicomWebManager
  }): void {
    for (const client of new Set(Object.values(clients))) {
      client.setAuthorizationPolicy(this.authorizationPolicy)
    }
  }

  handleServerSelection = async ({
    url,
    oidc,
  }: {
    url: string
    /** New settings, null to fall back to the deployment config */
    oidc?: OidcSettings | null
  }): Promise<void> => {
    const trimmedUrl = url.trim()
    console.info('select DICOMweb server: ', trimmedUrl)

    const resolvedUrl =
      trimmedUrl === '' || readStorage(SERVER_MODE_STORAGE_KEY) === 'default'
        ? undefined
        : normalizeServerUrl(trimmedUrl)
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
      window.location.reload()
      return
    }

    if (resolvedUrl === undefined) {
      this.setState({ clients: this.state.defaultClients })
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
      onError: this.handleDICOMwebError,
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
    /**
     * Use the newly created client for all storage classes. We may want to
     * make this more sophisticated in the future to allow users to override
     * the entire server configuration.
     */
    this.setState((state) => {
      const clients: { [key: string]: DicomWebManager } = {}
      for (const key in state.clients) {
        clients[key] = tmpClient
      }
      return { clients }
    })
  }

  applyAuthorization = (authorization: string): void => {
    for (const key of Object.keys(this.state.clients)) {
      this.state.clients[key].updateHeaders({ Authorization: authorization })
    }
    for (const key of Object.keys(this.state.defaultClients)) {
      this.state.defaultClients[key].updateHeaders({
        Authorization: authorization,
      })
    }
  }

  /**
   * Handle successful authentication event.
   *
   * Authorizes the DICOMweb client to access the DICOMweb server and directs
   * the user back to the pre-login route (via OIDC state).
   */
  handleSignIn = ({
    user,
    authorization,
    returnUrl,
  }: {
    user: User
    authorization: string
    returnUrl?: string
  }): void => {
    this.applyAuthorization(authorization)
    this.setState({ user })

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
        this.setState((state) => ({
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
        this.setState((state) => ({
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
       * oidc-client resolves signinRedirect as soon as navigation is assigned.
       * Keep the guard set until unload so concurrent 401s cannot start another
       * redirect.
       */
      if (!redirectedToIdp) {
        this.reauthInProgress = false
      }
    }
  }

  signIn(): void {
    if (this.auth !== undefined) {
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
          this.setState({
            isLoading: false,
            wasAuthSuccessful: true,
          })
        })
        .catch((error) => {
          console.error(error)
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.AUTH,
            new CustomError(
              errorTypes.AUTHENTICATION,
              'Could not sign-in user.',
            ),
          )
          /**
           * The failure page has no header, so a broken custom config could
           * not be changed from the UI and would be reused on every load.
           */
          let signInFailureMessage: string | undefined
          if (this.usesCachedOidcConfig) {
            clearCachedOidcConfig()
            this.usesCachedOidcConfig = false
            signInFailureMessage =
              'Sign-in with the custom OIDC configuration failed. It has been cleared; reload the page to use the default configuration.'
          }
          this.setState({
            isLoading: false,
            redirectTo: undefined,
            wasAuthSuccessful: false,
            signInFailureMessage,
          })
        })
    } else {
      this.setState({
        isLoading: false,
        redirectTo: undefined,
        wasAuthSuccessful: true,
      })
    }
  }

  componentDidMount(): void {
    const cachedSelection = loadServerSelection(getLocalStorage())
    if (cachedSelection.mode === 'custom') {
      void this.handleServerSelection({ url: cachedSelection.url })
    }

    if (this.auth != null) {
      this.unsubscribeAuthorization = this.auth.onAuthorizationChange(
        (authorization) => {
          this.applyAuthorization(authorization)
        },
      )
    }

    this.signIn()
  }

  componentWillUnmount(): void {
    this.unsubscribeAuthorization?.()
  }

  render(): React.ReactNode {
    const appInfo = {
      name: this.props.name,
      version: this.props.version,
      homepage: this.props.homepage,
      uid: '1.2.826.0.1.3680043.9.7433.1.5',
      organization: this.props.config.organization,
    }

    const enableWorklist = !(this.props.config.disableWorklist ?? false)
    const enableServerSelection =
      this.props.config.enableServerSelection ?? false
    let worklist: React.ReactNode
    if (enableWorklist) {
      worklist = <Worklist clients={this.state.clients} />
    } else {
      worklist = (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Worklist has been disabled.
        </div>
      )
    }

    let isLogoutPossible = false
    let onLogout: () => void
    if (this.auth != null) {
      onLogout = (): void => {
        void this.auth?.signOut()
      }
      isLogoutPossible = true
    } else {
      onLogout = () => {}
      isLogoutPossible = false
    }

    if (this.state.redirectTo !== undefined) {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Navigate to={this.state.redirectTo} replace />
        </BrowserRouter>
      )
    } else if (this.state.isLoading) {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <AppShell>
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <Header
                app={appInfo}
                user={this.state.user}
                showWorklistButton={false}
                onServerSelection={this.handleServerSelection}
                showServerSelectionButton={false}
                clients={this.state.clients}
                defaultClients={this.state.defaultClients}
              />
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center">
                <AppLoading fullscreen={false} label="Loading Slim" />
              </div>
            </div>
          </AppShell>
        </BrowserRouter>
      )
    } else if (!this.state.wasAuthSuccessful) {
      return (
        <InfoPage
          type="error"
          message={this.state.signInFailureMessage ?? 'Sign-in failed.'}
        />
      )
    } else if (this.state.error != null) {
      return <InfoPage type="error" message={this.state.error.message} />
    } else {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Routes key={this.state.authRecoveryKey}>
            <Route
              path={RoutePaths.ROOT}
              element={
                <AppShell>
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <Header
                      app={appInfo}
                      user={this.state.user}
                      showWorklistButton={false}
                      onServerSelection={this.handleServerSelection}
                      onUserLogout={isLogoutPossible ? onLogout : undefined}
                      showServerSelectionButton={enableServerSelection}
                      clients={this.state.clients}
                      defaultClients={this.state.defaultClients}
                    />
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      {worklist}
                    </div>
                  </div>
                </AppShell>
              }
            />
            <Route
              path={RoutePaths.STUDY}
              element={
                <AppShell>
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <Header
                      app={appInfo}
                      user={this.state.user}
                      showWorklistButton={enableWorklist}
                      onServerSelection={this.handleServerSelection}
                      onUserLogout={isLogoutPossible ? onLogout : undefined}
                      showServerSelectionButton={enableServerSelection}
                      clients={this.state.clients}
                      defaultClients={this.state.defaultClients}
                    />
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      <ParametrizedCaseViewer
                        clients={this.state.clients}
                        user={this.state.user}
                        config={this.props.config}
                        app={appInfo}
                      />
                    </div>
                  </div>
                </AppShell>
              }
            />
            <Route
              path={RoutePaths.GCP_STUDY}
              element={
                <AppShell>
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <Header
                      app={appInfo}
                      user={this.state.user}
                      showWorklistButton={enableWorklist}
                      onServerSelection={this.handleServerSelection}
                      onUserLogout={isLogoutPossible ? onLogout : undefined}
                      showServerSelectionButton={enableServerSelection}
                      clients={this.state.clients}
                      defaultClients={this.state.defaultClients}
                    />
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      <ParametrizedCaseViewer
                        clients={this.state.clients}
                        user={this.state.user}
                        config={this.props.config}
                        app={appInfo}
                      />
                    </div>
                  </div>
                </AppShell>
              }
            />
            <Route
              path={RoutePaths.LOGOUT}
              element={
                <AppShell>
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <Header
                      app={appInfo}
                      user={this.state.user}
                      showWorklistButton={false}
                      onServerSelection={this.handleServerSelection}
                      onUserLogout={isLogoutPossible ? onLogout : undefined}
                      showServerSelectionButton={enableServerSelection}
                      clients={this.state.clients}
                      defaultClients={this.state.defaultClients}
                    />
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center text-muted-foreground">
                      Logged out
                    </div>
                  </div>
                </AppShell>
              }
            />
          </Routes>
        </BrowserRouter>
      )
    }
  }
}

export default App

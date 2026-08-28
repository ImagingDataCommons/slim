import { Layout, Modal, message } from 'antd'
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
import AppLoading from './components/AppLoading'
import AppShell from './components/AppShell'
import CaseViewer from './components/CaseViewer'
import Header from './components/Header'
import InfoPage from './components/InfoPage'
import Worklist from './components/Worklist'
import { SettingsProvider } from './contexts/SettingsContext'
import { ValidationProvider } from './contexts/ValidationContext'
import type { AuthorizationPolicy } from './DicomWebManager'
import DicomWebManager from './DicomWebManager'
import { StorageClasses } from './data/uids'
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
  error?: ErrorMessageSettings
  /** Bumped after mid-session auth recovery so views remount and refetch. */
  authRecoveryKey: number
}

class App extends React.Component<AppProps, AppState> {
  private auth?: AuthManager
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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ensureAuthorized()
    } else if (error.status === 403) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.DICOMWEB,
        new CustomError(
          errorTypes.COMMUNICATION,
          'User is not authorized to access DICOMweb resources.',
        ),
      )
    }

    const logServerError = (): void => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

    // Only log in development environment
    if (process.env.NODE_ENV === 'development') {
      console.info('instatiate app')
      console.info(`app is located at "${props.config.path}"`)
    }

    const { protocol, host } = window.location
    const baseUri = `${protocol}//${host}`
    const appUri = joinUrl(props.config.path, baseUri)

    const oidcSettings = props.config.oidc
    if (oidcSettings !== undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          'app uses the following OIDC configuration: ',
          props.config.oidc,
        )
      }
      this.auth = new OidcManager(appUri, oidcSettings)
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

    message.config({ duration: 5 })

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
   * open a modal every time it is invoked.
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
          this.props.config.oidc?.authority,
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
    return await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: 'Send your access token to this server?',
        content: (
          <>
            <p>
              <strong>{origin}</strong> refused an anonymous request and is
              asking you to sign in.
            </p>
            <p>
              Slim can forward the access token issued to you by{' '}
              <strong>{authority ?? 'your identity provider'}</strong> so this
              server can identify you. Anyone holding that token can act as you
              against that provider for as long as it remains valid.
            </p>
            <p>Only allow this if you trust {origin}.</p>
          </>
        ),
        okText: 'Send token',
        cancelText: "Don't send",
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
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
    oidc?: OidcSettings
  }): Promise<void> => {
    const trimmedUrl = url.trim()
    console.info('select DICOMweb server: ', trimmedUrl)

    /** Handle OIDC configuration change */
    if (oidc != null) {
      console.info('applying custom OIDC configuration')
      const { protocol, host } = window.location
      const baseUri = `${protocol}//${host}`
      const appUri = joinUrl(this.props.config.path, baseUri)
      this.auth = new OidcManager(appUri, oidc)
      /** Re-subscribe to authorization changes */
      if (this.unsubscribeAuthorization != null) {
        this.unsubscribeAuthorization()
      }
      this.unsubscribeAuthorization = this.auth.onAuthorizationChange(
        (authorization) => {
          this.applyAuthorization(authorization)
        },
      )
    }

    if (
      trimmedUrl === '' ||
      window.localStorage.getItem('slim_server_selection_mode') === 'default'
    ) {
      this.setState({ clients: this.state.defaultClients })
      return
    }
    const resolvedUrl = normalizeServerUrl(trimmedUrl)
    window.localStorage.setItem('slim_selected_server', resolvedUrl)
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
        // Remount routed views so in-flight 401 failures refetch with the new token.
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
        // Token was refreshed without leaving the page; remount views to refetch.
        this.setState((state) => ({
          authRecoveryKey: state.authRecoveryKey + 1,
        }))
      }
    } catch (error) {
      console.error(error)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.AUTH,
        new CustomError(
          errorTypes.AUTHENTICATION,
          'Could not renew authorization.',
        ),
      )
    } finally {
      // oidc-client resolves signinRedirect as soon as navigation is assigned.
      // Keep the guard set until unload so concurrent 401s cannot start another redirect.
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
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.AUTH,
            new CustomError(
              errorTypes.AUTHENTICATION,
              'Could not sign-in user.',
            ),
          )
          this.setState({
            isLoading: false,
            redirectTo: undefined,
            wasAuthSuccessful: false,
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
    // Restore cached server selection if it exists
    const cachedServerUrl = window.localStorage.getItem('slim_selected_server')
    if (
      cachedServerUrl !== null &&
      cachedServerUrl !== undefined &&
      cachedServerUrl !== ''
    ) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.handleServerSelection({ url: cachedServerUrl })
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
    const enableMemoryMonitoring =
      this.props.config.enableMemoryMonitoring ?? true

    let worklist: React.ReactNode
    if (enableWorklist) {
      worklist = <Worklist clients={this.state.clients} />
    } else {
      worklist = <div>Worklist has been disabled.</div>
    }

    let isLogoutPossible = false
    let onLogout: () => void
    if (this.auth != null) {
      onLogout = (): void => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.auth?.signOut()
      }
      isLogoutPossible = true
    } else {
      onLogout = () => {}
      isLogoutPossible = false
    }

    /**
     * Fill AppShell's main pane. flex + minHeight:0 keeps ant-layout from
     * sizing to content and spilling into the in-flow MemoryFooter.
     */
    const layoutStyle: React.CSSProperties = {
      flex: '1 1 0%',
      minHeight: 0,
      overflow: 'hidden',
    }
    const layoutContentStyle: React.CSSProperties = {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
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
          <AppShell enableMemoryMonitoring={false}>
            <Layout style={layoutStyle}>
              <Header
                app={appInfo}
                user={this.state.user}
                showWorklistButton={false}
                onServerSelection={this.handleServerSelection}
                showServerSelectionButton={false}
                clients={this.state.clients}
                defaultClients={this.state.defaultClients}
              />
              <Layout.Content
                style={{
                  ...layoutContentStyle,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppLoading fullscreen={false} label="Loading Slim" />
              </Layout.Content>
            </Layout>
          </AppShell>
        </BrowserRouter>
      )
    } else if (!this.state.wasAuthSuccessful) {
      return <InfoPage type="error" message="Sign-in failed." />
    } else if (this.state.error != null) {
      return <InfoPage type="error" message={this.state.error.message} />
    } else {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Routes key={this.state.authRecoveryKey}>
            <Route
              path={RoutePaths.ROOT}
              element={
                <AppShell enableMemoryMonitoring={enableMemoryMonitoring}>
                  <Layout style={layoutStyle}>
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
                    <Layout.Content style={layoutContentStyle}>
                      {worklist}
                    </Layout.Content>
                  </Layout>
                </AppShell>
              }
            />
            <Route
              path={RoutePaths.STUDY}
              element={
                <SettingsProvider>
                  <AppShell enableMemoryMonitoring={enableMemoryMonitoring}>
                    <Layout style={layoutStyle}>
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
                      <Layout.Content style={layoutContentStyle}>
                        <ParametrizedCaseViewer
                          clients={this.state.clients}
                          user={this.state.user}
                          config={this.props.config}
                          app={appInfo}
                        />
                      </Layout.Content>
                    </Layout>
                  </AppShell>
                </SettingsProvider>
              }
            />
            <Route
              path={RoutePaths.GCP_STUDY}
              element={
                <SettingsProvider>
                  <AppShell enableMemoryMonitoring={enableMemoryMonitoring}>
                    <Layout style={layoutStyle}>
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
                      <Layout.Content style={layoutContentStyle}>
                        <ParametrizedCaseViewer
                          clients={this.state.clients}
                          user={this.state.user}
                          config={this.props.config}
                          app={appInfo}
                        />
                      </Layout.Content>
                    </Layout>
                  </AppShell>
                </SettingsProvider>
              }
            />
            <Route
              path={RoutePaths.LOGOUT}
              element={
                <AppShell enableMemoryMonitoring={enableMemoryMonitoring}>
                  <Layout style={layoutStyle}>
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
                    <Layout.Content style={layoutContentStyle}>
                      Logged out
                    </Layout.Content>
                  </Layout>
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

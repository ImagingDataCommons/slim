import React from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams
} from 'react-router-dom'
import { Layout, message } from 'antd'
import { FaSpinner } from 'react-icons/fa'
import * as dwc from 'dicomweb-client'

import AppConfig, { ServerSettings, ErrorMessageSettings } from './AppConfig'
import CaseViewer from './components/CaseViewer'
import Header from './components/Header'
import InfoPage from './components/InfoPage'
import Worklist from './components/Worklist'

import { User, AuthManager } from './auth'
import OidcManager from './auth/OidcManager'
import { StorageClasses } from './data/uids'
import DicomWebManager from './DicomWebManager'
import { joinUrl } from './utils/url'
import { CustomError, errorTypes } from './utils/CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from './services/NotificationMiddleware'

function ParametrizedCaseViewer ({ clients, user, app, config }: {
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

  const enableAnnotationTools = !(config.disableAnnotationTools ?? false)
  const preload = config.preload ?? false
  return (
    <CaseViewer
      clients={clients}
      user={user}
      annotations={config.annotations}
      preload={preload}
      app={app}
      enableAnnotationTools={enableAnnotationTools}
      studyInstanceUID={studyInstanceUID}
    />
  )
}

function _createClientMapping ({ baseUri, gcpBaseUrl, settings, onError }: {
  baseUri: string
  gcpBaseUrl: string
  settings: ServerSettings[]
  onError: (
    error: dwc.api.DICOMwebClientError,
    serverSettings: ServerSettings
  ) => void
}): { [sopClassUID: string]: DicomWebManager } {
  const storageClassMapping: { [key: string]: number } = { default: 0 }
  const clientMapping: { [sopClassUID: string]: DicomWebManager } = {}

  settings.forEach(serverSettings => {
    if (serverSettings.storageClasses != null) {
      serverSettings.storageClasses.forEach(sopClassUID => {
        if (Object.values<string>(StorageClasses).includes(sopClassUID)) {
          if (sopClassUID in storageClassMapping) {
            storageClassMapping[sopClassUID] += 1
          } else {
            storageClassMapping[sopClassUID] = 1
          }
        } else {
          console.warn(
            `unknown storage class "${sopClassUID}" specified ` +
            `for configured server "${serverSettings.id}"`
          )
        }
      })
    } else {
      if (window.location.pathname.includes('/projects/')) {
        const pathname = window.location.pathname.split('/study/')[0]
        const pathUrl = `${gcpBaseUrl}${pathname}/dicomWeb`
        serverSettings.url = pathUrl
      }

      storageClassMapping.default += 1
      clientMapping.default = new DicomWebManager({
        baseUri,
        settings: [serverSettings],
        onError
      })
    }
  })

  if (storageClassMapping.default > 1) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(
        errorTypes.COMMUNICATION,
        'Only one default server can be configured without specification ' +
        'of storage classes.'
      )
    )
  }

  for (const key in storageClassMapping) {
    if (key === 'default') {
      continue
    }
    if (storageClassMapping[key] > 1) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.COMMUNICATION,
          'Only one configured server can specify a given storage class. ' +
          `Storage class "${key}" is specified by more than one ` +
          'of the configured servers.'
        )
      )
    }
  }

  if (Object.keys(storageClassMapping).length > 1) {
    settings.forEach(server => {
      const client = new DicomWebManager({
        baseUri,
        settings: [server],
        onError
      })
      if (server.storageClasses != null) {
        server.storageClasses.forEach(sopClassUID => {
          clientMapping[sopClassUID] = client
        })
      }
    })
  }

  Object.values(StorageClasses).forEach(sopClassUID => {
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
  user?: User
  isLoading: boolean
  redirectTo?: string
  wasAuthSuccessful: boolean
  error?: ErrorMessageSettings
}

class App extends React.Component<AppProps, AppState> {
  private readonly auth?: AuthManager

  private readonly handleDICOMwebError = (
    error: dwc.api.DICOMwebClientError,
    serverSettings: ServerSettings
  ): void => {
    if (error.status === 401) {
      this.signIn()
    } else if (error.status === 403) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.DICOMWEB,
        new CustomError(
          errorTypes.COMMUNICATION,
          'User is not authorized to access DICOMweb resources.')
      )
    }

    const logServerError = (): void => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.DICOMWEB,
        new CustomError(
          errorTypes.COMMUNICATION,
          'An unexpected server error occured.'
        )
      )
    }

    if (serverSettings.errorMessages !== undefined) {
      serverSettings.errorMessages.forEach((setting: ErrorMessageSettings) => {
        if (error.status === setting.status) {
          this.setState({
            error: {
              status: error.status,
              message: setting.message
            }
          })
        } else if (error.status === 500) {
          logServerError()
        }
      })
    } else if (error.status === 500) {
      logServerError()
    }
  }

  constructor (props: AppProps) {
    super(props)

    console.info('instatiate app')
    console.info(`app is located at "${props.config.path}"`)
    const { protocol, host } = window.location
    const baseUri = `${protocol}//${host}`
    const appUri = joinUrl(props.config.path, baseUri)

    const oidcSettings = props.config.oidc
    if (oidcSettings !== undefined) {
      console.info(
        'app uses the following OIDC configuration: ',
        props.config.oidc
      )
      this.auth = new OidcManager(appUri, oidcSettings)
    }

    if (props.config.servers.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.COMMUNICATION,
          'One server needs to be configured.')
      )
    }
    console.info(
      'app uses the following DICOMweb server configuration: ',
      props.config.servers
    )

    this.handleServerSelection = this.handleServerSelection.bind(this)

    message.config({ duration: 5 })
    this.addGcpSecondaryAnnotationServer(props.config)

    this.state = {
      clients: _createClientMapping({
        baseUri,
        gcpBaseUrl: props.config.gcpBaseUrl ?? 'https://healthcare.googleapis.com/v1',
        settings: props.config.servers,
        onError: this.handleDICOMwebError
      }),
      isLoading: true,
      wasAuthSuccessful: false
    }
  }

  addGcpSecondaryAnnotationServer (config: AppProps['config']): void {
    const serverId = 'gcp_secondary_annotation_server'
    const urlParams = new URLSearchParams(window.location.search)
    const url = urlParams.get('gcp')
    const gcpSecondaryAnnotationServer = config.servers.find(
      (server) => server.id === serverId
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
          StorageClasses.PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE
        ]
      })
    }
  }

  handleServerSelection ({ url }: { url: string }): void {
    console.info('select DICOMweb server: ', url)
    const tmpClient = new DicomWebManager({
      baseUri: '',
      settings: [{
        id: 'tmp',
        url,
        read: true,
        write: false
      }],
      onError: this.handleDICOMwebError
    })
    tmpClient.updateHeaders(this.state.clients.default.headers)
    /**
     * Use the newly created client for all storage classes. We may want to
     * make this more sophisticated in the future to allow users to override
     * the entire server configuration.
     */
    this.setState(state => {
      const clients: { [key: string]: DicomWebManager } = {}
      for (const key in state.clients) {
        clients[key] = tmpClient
      }
      return { clients }
    })
  }

  /**
   * Handle successful authentication event.
   *
   * Authorizes the DICOMweb client to access the DICOMweb server and directs
   * the user back to the App.
   *
   * @param user - Information about the user
   * @param authorization - Value of the "Authorization" HTTP header field
   */
  handleSignIn = ({ user, authorization }: {
    user: User
    authorization: string
  }): void => {
    for (const key in this.state.clients) {
      const client = this.state.clients[key]
      client.updateHeaders({ Authorization: authorization })
    }
    const storedPath = window.localStorage.getItem('slim_path')
    const storedSearch = window.localStorage.getItem('slim_search')
    if (storedPath != null) {
      const currentPath = window.location.pathname
      if (storedPath !== currentPath) {
        let path = storedPath
        if (storedSearch != null) {
          path += storedSearch
        }
        window.location.href = path
      }
    }
    window.localStorage.removeItem('slim_path')
    window.localStorage.removeItem('slim_search')
    this.setState({ user: user })
  }

  signIn (): void {
    if (this.auth !== undefined) {
      console.info('try to sign in user')
      this.auth.signIn({ onSignIn: this.handleSignIn }).then(() => {
        console.info('sign-in was successful')
        this.setState({
          isLoading: false,
          wasAuthSuccessful: true
        })
      }).catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.AUTH,
          new CustomError(
            errorTypes.AUTHENTICATION,
            'Could not sign-in user.')
        )
        this.setState({
          isLoading: false,
          redirectTo: undefined,
          wasAuthSuccessful: false
        })
      })
    } else {
      this.setState({
        isLoading: false,
        redirectTo: undefined,
        wasAuthSuccessful: true
      })
    }
  }

  componentDidMount (): void {
    const path = window.localStorage.getItem('slim_path')
    if (path == null) {
      window.localStorage.setItem('slim_path', window.location.pathname)
      window.localStorage.setItem('slim_search', window.location.search)
    }
    this.signIn()
  }

  render (): React.ReactNode {
    const appInfo = {
      name: this.props.name,
      version: this.props.version,
      homepage: this.props.homepage,
      uid: '1.2.826.0.1.3680043.9.7433.1.5',
      organization: this.props.config.organization
    }

    const enableWorklist = !(
      this.props.config.disableWorklist ?? false
    )
    const enableServerSelection = (
      this.props.config.enableServerSelection ?? false
    )

    let worklist
    if (enableWorklist) {
      worklist = <Worklist clients={this.state.clients} />
    } else {
      worklist = <div>Worklist has been disabled.</div>
    }

    let isLogoutPossible = false
    let onLogout: () => void
    if (
      // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
      this.props.config.oidc != null &&
      this.props.config.oidc.endSessionEndpoint != null
    ) {
      onLogout = (): void => {
        if (this.auth != null) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.auth.signOut()
        }
      }
      isLogoutPossible = true
    } else {
      onLogout = () => {}
      isLogoutPossible = false
    }

    const layoutStyle = { height: '100vh' }
    const layoutContentStyle = { height: '100%' }

    if (this.state.redirectTo !== undefined) {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Navigate to={this.state.redirectTo} replace />
        </BrowserRouter>
      )
    } else if (this.state.isLoading) {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Layout style={layoutStyle}>
            <Header
              app={appInfo}
              user={this.state.user}
              showWorklistButton={false}
              onServerSelection={this.handleServerSelection}
              showServerSelectionButton={false}
              clients={this.state.clients}
            />
            <Layout.Content style={layoutContentStyle}>
              <FaSpinner />
            </Layout.Content>
          </Layout>
        </BrowserRouter>
      )
    } else if (!this.state.wasAuthSuccessful) {
      return (
        <InfoPage type='error' message='Sign-in failed.' />
      )
    } else if (this.state.error != null) {
      return (
        <InfoPage type='error' message={this.state.error.message} />
      )
    } else {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Routes>
            <Route
              path='/'
              element={
                <Layout style={layoutStyle}>
                  <Header
                    app={appInfo}
                    user={this.state.user}
                    showWorklistButton={false}
                    onServerSelection={this.handleServerSelection}
                    onUserLogout={isLogoutPossible ? onLogout : undefined}
                    showServerSelectionButton={enableServerSelection}
                  />
                  <Layout.Content style={layoutContentStyle}>
                    {worklist}
                  </Layout.Content>
                </Layout>
              }
            />
            <Route
              path='/studies/:studyInstanceUID/*'
              element={
                <Layout style={layoutStyle}>
                  <Header
                    app={appInfo}
                    user={this.state.user}
                    showWorklistButton={enableWorklist}
                    onServerSelection={this.handleServerSelection}
                    onUserLogout={isLogoutPossible ? onLogout : undefined}
                    showServerSelectionButton={enableServerSelection}
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
              }
            />
            <Route
              path='/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore/study/:studyInstanceUID/*'
              element={
                <Layout style={layoutStyle}>
                  <Header
                    app={appInfo}
                    user={this.state.user}
                    showWorklistButton={enableWorklist}
                    onServerSelection={this.handleServerSelection}
                    onUserLogout={isLogoutPossible ? onLogout : undefined}
                    showServerSelectionButton={enableServerSelection}
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
              }
            />
            <Route
              path='/logout'
              element={
                <Layout style={layoutStyle}>
                  <Header
                    app={appInfo}
                    user={this.state.user}
                    showWorklistButton={false}
                    onServerSelection={this.handleServerSelection}
                    onUserLogout={isLogoutPossible ? onLogout : undefined}
                    showServerSelectionButton={enableServerSelection}
                  />
                  Logged out
                </Layout>
              }
            />
          </Routes>
        </BrowserRouter>
      )
    }
  }
}

export default App

import React from 'react'
import {
  BrowserRouter,
  Redirect,
  Route,
  Switch,
} from 'react-router-dom'
import * as dwc from 'dicomweb-client'
import { Layout, message } from 'antd'
import { FaSpinner } from 'react-icons/fa'

import AppConfig, { ServerSettings } from './AppConfig'
import Header from './components/Header'
import CaseViewer from './components/CaseViewer'
import Worklist from './components/Worklist'

import 'antd/dist/antd.less'
import './App.less'
import { ErrorMessageSettings } from './AppConfig'
import { joinUrl } from './utils/url'
import { User, AuthManager } from './auth'
import OidcManager from './auth/OidcManager'
import DicomWebManager from './DicomWebManager'

import { version } from '../package.json'
import InfoPage from './components/InfoPage'

interface AppProps {
  version: string
  config: AppConfig
}

interface AppState {
  client: DicomWebManager
  user?: User
  isLoading: boolean
  redirectTo?: string
  wasAuthSuccessful: boolean
  error?: ErrorMessageSettings
}

class App extends React.Component<AppProps, AppState> {
  private readonly auth?: AuthManager

  constructor (props: AppProps) {
    super(props)

    const { protocol, host } = window.location
    const baseUri = `${protocol}//${host}`
    const appUri = joinUrl(props.config.path, baseUri)

    const oidcSettings = props.config.oidc
    if (oidcSettings !== undefined) {
      this.auth = new OidcManager(appUri, oidcSettings)
    }

    if (props.config.servers.length === 0) {
      throw Error('At least one server needs to be configured.')
    }

    message.config({ duration: 5 })

    const handleError = (error: dwc.api.DICOMwebClientError, serverSettings: ServerSettings) => {
      if (serverSettings.errorMessages !== undefined) {
        serverSettings.errorMessages.forEach(({ status, message }: ErrorMessageSettings) => {
          if (error.status === status) {
            this.setState({ error: {
              status: error.status,
              message
            } });
          }
        })
      }
    };

    this.state = {
      client: new DicomWebManager({
        baseUri: baseUri,
        settings: props.config.servers,
        onError: handleError
      }),
      isLoading: true,
      wasAuthSuccessful: false,
    }
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
    const client = this.state.client
    client.updateHeaders({ Authorization: authorization })
    this.setState({
      user: user,
      client: client,
      wasAuthSuccessful: true,
      isLoading: false,
      redirectTo: '/'
    })
  }

  componentDidMount (): void {
    if (this.auth !== undefined) {
      this.auth.signIn({ onSignIn: this.handleSignIn }).then(() => {
        console.info('sign-in successful')
        this.setState({
          isLoading: false,
          redirectTo: undefined,
          wasAuthSuccessful: true
        })
      }).catch((error) => {
        console.error('sign-in failed ', error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error('Could not sign-in user')
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

  render (): React.ReactNode {
    const appInfo = {
      name: 'Slim',
      version: version,
      uid: '1.2.826.0.1.3680043.9.7433.1.5',
      organization: this.props.config.organization
    }

    const enableWorklist = !this.props.config.disableWorklist
    const enableAnnotationTools = !this.props.config.disableAnnotationTools

    let worklist
    if (enableWorklist) {
      worklist = <Worklist client={this.state.client} />
    } else {
      worklist = <div>Worklist has been disabled.</div>
    }

    const layoutStyle = { height: '100vh' }
    const layoutContentStyle = { height: '100%' }

    if (this.state.redirectTo !== undefined) {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Redirect push to={this.state.redirectTo}/>
        </BrowserRouter>
      )
    } else if (this.state.isLoading) {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Layout style={layoutStyle}>
            <Header
              app={appInfo}
              showWorklistButton={false}
            />
            <Layout.Content style={layoutContentStyle}>
              <FaSpinner />
            </Layout.Content>
          </Layout>
        </BrowserRouter>
      )
    } else if (!this.state.wasAuthSuccessful) {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Layout style={layoutStyle}>
            <Header
              app={appInfo}
              showWorklistButton={false}
            />
            <Layout.Content style={layoutContentStyle}>
              <div>Sign-in failed.</div>
            </Layout.Content>
          </Layout>
        </BrowserRouter>
      )
    } else if (this.state.error) {
      return (
        <InfoPage type="error" message={this.state.error.message} />
      )
    } else {
      return (
        <BrowserRouter basename={this.props.config.path}>
          <Switch>
            <Route
              path='/studies/:StudyInstanceUID'
              render={(routeProps) => (
                <Layout style={layoutStyle}>
                  <Header
                    app={appInfo}
                    user={this.state.user}
                    showWorklistButton={!this.props.config.disableWorklist}
                  />
                  <Layout.Content style={layoutContentStyle}>
                    <CaseViewer
                      client={this.state.client}
                      user={this.state.user}
                      renderer={this.props.config.renderer}
                      annotations={this.props.config.annotations}
                      app={appInfo}
                      enableAnnotationTools={enableAnnotationTools}
                      studyInstanceUID={routeProps.match.params.StudyInstanceUID}
                    />
                  </Layout.Content>
                </Layout>
              )}
            />
            <Route exact path='/'>
              <Layout style={layoutStyle}>
                <Header
                  app={appInfo}
                  user={this.state.user}
                  showWorklistButton={false}
                />
                <Layout.Content style={layoutContentStyle}>
                  {worklist}
                </Layout.Content>
              </Layout>
            </Route>
              </Switch>
        </BrowserRouter>
      )
    }
  }
}

export default App

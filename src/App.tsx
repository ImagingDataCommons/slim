import React from 'react'
import {
  BrowserRouter,
  Route,
  Switch
} from 'react-router-dom'
import { Layout, message } from 'antd'
import { FaSpinner } from 'react-icons/fa'

import AppConfig from './AppConfig'
import Header from './components/Header'
import CaseViewer from './components/CaseViewer'
import Worklist from './components/Worklist'

import 'antd/dist/antd.less'
import './App.less'
import { joinUrl } from './utils/url'
import { User, AuthManager } from './auth'
import OidcManager from './auth/OidcManager'
import DicomWebManager from './DicomWebManager'

import { version } from '../package.json'

interface AppProps {
  version: string
  config: AppConfig
}

interface AppState {
  client: DicomWebManager
  user?: User
  isLoading: boolean
  wasAuthSuccessful: boolean
}

class App extends React.Component<AppProps, AppState> {
  private readonly auth?: AuthManager

  private readonly baseUri: string

  constructor (props: AppProps) {
    super(props)

    const { protocol, host } = window.location
    this.baseUri = joinUrl(props.config.path, `${protocol}//${host}`)

    const oidcSettings = props.config.oidc
    if (oidcSettings !== undefined) {
      this.auth = new OidcManager(this.baseUri, oidcSettings)
    }

    if (props.config.servers.length === 0) {
      throw Error('At least one server needs to be configured.')
    }

    message.config({ duration: 5 })

    this.state = {
      client: new DicomWebManager({
        baseUri: this.baseUri,
        settings: props.config.servers
      }),
      isLoading: true,
      wasAuthSuccessful: false
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
      isLoading: false
    })
    window.location.hash = ''
  }

  componentDidMount (): void {
    if (this.auth !== undefined) {
      this.auth.signIn({ onSignIn: this.handleSignIn }).then(() => {
        console.info('sign-in successful')
      }).catch((error) => {
        console.error('sign-in failed ', error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error('Could not sign-in user')
        this.setState({ isLoading: false })
      })
    } else {
      this.setState({
        isLoading: false,
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

    let worklist
    if (!this.props.config.disableWorklist) {
      worklist = <Worklist client={this.state.client} />
    } else {
      worklist = <div>Worklist has been disabled.</div>
    }

    const layoutStyle = { height: '100vh' }
    const layoutContentStyle = { height: '100%' }

    if (this.state.isLoading) {
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
                      enableAnnotationTools={!this.props.config.disableAnnotationTools}
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

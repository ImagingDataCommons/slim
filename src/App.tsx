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
    this.baseUri = joinUrl(props.config.path, `${protocol}//${host}//${props.config.routerBasename}`)

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

  onSignIn = ({ user, authorization }: {
    user: User
    authorization: string
  }): void => {
    const client = this.state.client
    client.updateHeaders({ Authorization: authorization })
    this.setState(state => ({
      user: user,
      client: client,
      wasAuthSuccessful: true,
      isLoading: false
    }))
    window.location.hash = ''
  }

  componentDidMount (): void {
    if (this.auth !== undefined) {
      this.auth.signIn({ onSignIn: this.onSignIn }).then(() => {
        console.info('sign-in successful')
      }).catch((error) => {
        console.error('sign-in failed ', error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error('Could not sign-in user')
        this.setState(state => ({ isLoading: false }))
      })
    } else {
      this.setState(state => ({
        isLoading: false,
        wasAuthSuccessful: true
      }))
    }
  }

  render (): React.ReactNode {
    const appInfo = {
      name: 'Slim',
      version: version,
      uid: '1.2.826.0.1.3680043.9.7433.1.5',
      organization: this.props.config.organization
    }

    if (this.state.isLoading) {
      return (
        <BrowserRouter basename={this.props.config.routerBasename}>
          <Layout style={{ height: '100vh' }}>
            <Header app={appInfo} />
            <Layout.Content style={{ height: '100%' }}>
              <FaSpinner />
            </Layout.Content>
          </Layout>
        </BrowserRouter>
      )
    } else if (!this.state.wasAuthSuccessful) {
      return (
        <BrowserRouter basename={this.props.config.routerBasename}>
          <Layout style={{ height: '100vh' }}>
            <Header app={appInfo} />
            <Layout.Content style={{ height: '100%' }}>
              <div>Error. Sign-in failed.</div>
            </Layout.Content>
          </Layout>
        </BrowserRouter>
      )
    } else {
      return (
        <BrowserRouter basename={this.props.config.routerBasename}>
          <Layout style={{ height: '100vh' }}>
            <Header
              app={appInfo}
              user={this.state.user}
            />
            <Layout.Content style={{ height: '100%' }}>
              <Switch>
                <Route
                  path='/studies/:StudyInstanceUID'
                  render={(routeProps) => (
                    <CaseViewer
                      client={this.state.client}
                      user={this.state.user}
                      annotations={this.props.config.annotations}
                      app={appInfo}
                      studyInstanceUID={routeProps.match.params.StudyInstanceUID}
                    />
                  )}
                />
                <Route exact path='/'>
                  <Worklist client={this.state.client} />
                </Route>
              </Switch>
            </Layout.Content>
          </Layout>
        </BrowserRouter>
      )
    }
  }
}

export default App

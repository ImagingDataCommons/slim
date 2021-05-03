import React from 'react'
import {
  BrowserRouter,
  Switch,
  Route,
} from 'react-router-dom'
import { UserManager } from 'oidc-client';
import { Layout, message } from 'antd'
import * as dwc from 'dicomweb-client'

import AppConfig from './AppConfig'
import Callback from './components/Callback'
import Header from './components/Header'
import Viewer from './components/Viewer'
import Worklist from './components/Worklist'

import 'antd/dist/antd.less'
import './App.less'
import { joinUrl } from './utils/url'

import { version } from '../package.json'


interface AppProps {
  version: string
  config: AppConfig
}

interface AppState {
  client: dwc.api.DICOMwebClient
  user?: {
    name: string
    username: string
    email: string
  }
}

class App extends React.Component<AppProps, AppState> {
  private readonly clientSettings: dwc.api.DICOMwebClientOptions

  private readonly userManager?: UserManager

  constructor (props: AppProps) {
    super(props)

    const { protocol, host } = window.location
    const baseUri = joinUrl(props.config.path, `${protocol}//${host}`)

    const oidcSettings = props.config.oidc
    if (oidcSettings !== undefined) {
      this.userManager = new UserManager({
        authority: oidcSettings.authority,
        client_id: oidcSettings.clientId,
        redirect_uri: joinUrl(oidcSettings.redirectPath, baseUri),
        scope: oidcSettings.scope,
        response_type: 'code',
        loadUserInfo: true,
        automaticSilentRenew: true
      })
    }

    // For now, we only select one server
    const serverSettings = props.config.servers[0]
    if (serverSettings === undefined) {
      throw Error('At least one server needs to be configured.')
    }

    if (serverSettings.url !== undefined) {
      this.clientSettings = { url: serverSettings.url }
    } else if (serverSettings.path !== undefined) {
      this.clientSettings = { url: joinUrl(serverSettings.path, baseUri) }
    } else {
      throw new Error(
        'Either path or full URL needs to be configured for server.'
      )
    }
    if (serverSettings.qidoPathPrefix !== undefined) {
      this.clientSettings.qidoUrlPrefix = serverSettings.qidoPathPrefix
    }
    if (serverSettings.wadoPathPrefix !== undefined) {
      this.clientSettings.wadoUrlPrefix = serverSettings.wadoPathPrefix
    }
    if (serverSettings.stowPathPrefix !== undefined) {
      this.clientSettings.stowUrlPrefix = serverSettings.stowPathPrefix
    }

    this.state = {
      client: new dwc.api.DICOMwebClient(this.clientSettings)
    }
  }

  updateClientHeaders ({ token }: { token: string }): void {
    const client = this.state.client
    client.headers['Authorization'] = `Bearer ${token}`
    this.setState((state) => ({ client: client }))
  }

  componentDidMount (): void {
    const manager = this.userManager
    if (manager !== undefined) {
      console.log('sign in')
      manager.signinRedirect().then(() => {
        console.log('successfully signed in')
        // FIXME
      }).catch((error) => {
        message.error('Signin failed')
        console.error('signin failed ', error)
      })
    }
  }

  render (): React.ReactNode {
    if (this.state.client === undefined) {
      return null
    }
    const appInfo = {
      name: 'Slide Microscopy Viewer',
      version: version,
      uid: '1.2.826.0.1.3680043.9.7433.1.5'
    }
    return (
      <BrowserRouter>
        <Layout style={{ height: '100vh' }}>
          <Header
            app={appInfo}
            user={this.state.user}
          />
          <Layout.Content style={{ height: '100%' }}>
            <Switch>
              <Route path='/callback'>
                <Callback />
              </Route>
              <Route exact path='/'>
                <Worklist client={this.state.client} />
              </Route>
              <Route
                path='/studies/:StudyInstanceUID'
                render={(routeProps) => (
                  <Viewer
                    client={this.state.client}
                    user={this.state.user}
                    annotations={this.props.config.annotations}
                    app={appInfo}
                    studyInstanceUID={routeProps.match.params.StudyInstanceUID}
                  />
                )}
              />
            </Switch>
          </Layout.Content>
        </Layout>
      </BrowserRouter>
    )
  }
}

export default App

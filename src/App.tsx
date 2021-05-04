import React from 'react'
import {
  BrowserRouter,
  Route,
  Switch,
} from 'react-router-dom'
import { UserManager, User as UserData } from 'oidc-client';
import { Layout, message } from 'antd'
import { FaSpinner } from 'react-icons/fa'
import * as dwc from 'dicomweb-client'

import AppConfig from './AppConfig'
import Header from './components/Header'
import Viewer from './components/Viewer'
import Worklist from './components/Worklist'

import 'antd/dist/antd.less'
import './App.less'
import { joinUrl, isAuthorizationCodeInUrl } from './utils/url'

import { version } from '../package.json'


interface User {
  name: string
  email: string
}

interface AppProps {
  version: string
  config: AppConfig
}

interface AppState {
  client: dwc.api.DICOMwebClient
  user?: User
  needsSignin: boolean
  isLoading: boolean
}

class App extends React.Component<AppProps, AppState> {
  private readonly clientSettings: dwc.api.DICOMwebClientOptions

  private readonly userManager?: UserManager

  private readonly baseUri: string

  constructor (props: AppProps) {
    super(props)

    const { protocol, host } = window.location
    this.baseUri = joinUrl(props.config.path, `${protocol}//${host}`)

    const oidcSettings = props.config.oidc
    let needsSignin = false
    if (oidcSettings !== undefined) {
      needsSignin = true
      let responseType = 'code'
      if (oidcSettings.grantType !== undefined) {
        if (oidcSettings.grantType === 'implicit') {
          responseType = 'id_token token'
        }
      }
      this.userManager = new UserManager({
        authority: oidcSettings.authority,
        client_id: oidcSettings.clientId,
        redirect_uri: this.baseUri,
        scope: oidcSettings.scope,
        response_type: responseType,
        loadUserInfo: true,
        automaticSilentRenew: true,
        revokeAccessTokenOnSignout: true
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
      this.clientSettings = { url: joinUrl(serverSettings.path, this.baseUri) }
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
      client: new dwc.api.DICOMwebClient(this.clientSettings),
      isLoading: false,
      needsSignin: needsSignin
    }

    this.signOutUser = this.signOutUser.bind(this)
    this.signInUser = this.signInUser.bind(this)
    this.setUser = this.setUser.bind(this)
    this.setAuthorizationHeader = this.setAuthorizationHeader.bind(this)
  }

  setUser (userData: UserData): void {
    const profile = userData.profile
    if (profile !== undefined) {
      if (profile.name === undefined || profile.email === undefined) {
        message.error('User name and email not available')
        throw Error('User name and email not available')
      }
      const user = {
        name: profile.name,
        email: profile.email
      }
      this.setState((state) => ({ user: user }))
    } else {
      message.error('User profile not available')
      console.error('user profile not available')
    }
  }

  setAuthorizationHeader (userData: UserData): void {
    const client = this.state.client
    const auth = `${userData.token_type} ${userData.access_token}`
    client.headers['Authorization'] = auth
    this.setState((state) => ({ client: client }))
  }

  signInUser (): void {
    const manager = this.userManager
    if (manager !== undefined) {
      this.setState((state) => ({ isLoading: true }))
      if (isAuthorizationCodeInUrl(window.location)) {
        /* Handle the callback from the authorization server: extract the code
         * from the callback URL, obtain user information and the access token
         * for the DICOMweb server.
         */
        console.log('obtaining access token')
        manager.signinCallback().then((userData) => {
          this.setAuthorizationHeader(userData)
          this.setUser(userData)
          window.location.href = this.baseUri
        }).catch((error) => {
          message.error('Authorization failed')
          console.error('authorization failed ', error)
          manager.stopSilentRenew()
        })
      } else {
        /* Redirect to the authorization server to authenticate the user
         * and authorize the application to obtain user information and access
         * the DICOMweb server.
         */
        manager.getUser().then((userData) => {
          if (userData === null || userData.expired) {
            manager.signinRedirect().then(() => {
              console.log('successfully signed in')
              console.log('awaiting callback...')
            }).catch((error) => {
              message.error('Signin failed')
              console.error('signin failed ', error)
              manager.stopSilentRenew()
            })
          } else {
            this.setAuthorizationHeader(userData)
            this.setUser(userData)
          }
        })
      }
      this.setState((state) => ({ isLoading: false }))
    }
  }

  signOutUser (): void {
    const manager = this.userManager
    if (manager !== undefined) {
      manager.removeUser().then(() => {
        console.log('signout successuful')
        this.setState((state) => ({
          user: undefined,
          needsSignin: false
        }))
      }).catch((error) => {
        console.error('signout failed')
      })
    }
  }

  componentDidMount (): void {
    if (this.state.needsSignin) {
      this.signInUser()
    }
  }

  render (): React.ReactNode {
    if (this.userManager !== undefined) {
      if (this.state.user === undefined) {
        return null
      }
    }
    const appInfo = {
      name: 'Slide Microscopy Viewer',
      version: version,
      uid: '1.2.826.0.1.3680043.9.7433.1.5',
      organization: this.props.config.organization
    }
    let content
    if (this.state.isLoading) {
      content = <FaSpinner />
    } else {
      content = (
        <Switch>
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
          <Route exact path='/'>
            <Worklist client={this.state.client} />
          </Route>
        </Switch>
      )
    }

    return (
      <BrowserRouter>
        <Layout style={{ height: '100vh' }}>
          <Header
            app={appInfo}
            user={this.state.user}
          />
          <Layout.Content style={{ height: '100%' }}>
            {content}
          </Layout.Content>
        </Layout>
      </BrowserRouter>
    )
  }
}

export default App

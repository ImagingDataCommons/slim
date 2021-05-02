import React from 'react'
import {
  BrowserRouter,
  Switch,
  Route,
} from 'react-router-dom'
import { Layout } from 'antd'
import * as dwc from 'dicomweb-client'

import AppConfig from './AppConfig'
import Header from './components/Header'
import Viewer from './components/Viewer'
import Worklist from './components/Worklist'

import 'antd/dist/antd.less'
import './App.less'

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
  private readonly clientConfig: dwc.api.DICOMwebClientOptions

  private readonly tokenRefresher?: NodeJS.Timeout

  constructor (props: AppProps) {
    super(props)

    // For now, we only select one server
    const server = props.config.servers[0]
    if (server === undefined) {
      throw Error('At least one server needs to be configured.')
    }

    if (server.url !== undefined) {
      this.clientConfig = {
        url: server.url,
        headers: {}
      }
    } else if (server.path !== undefined) {
      this.clientConfig = {
        url: `${window.location.origin}${server.path}`,
        headers: {}
      }
    } else {
      throw new Error(
        'Either path or full URL needs to be configured for server.'
      )
    }
    if (server.qidoPathPrefix !== undefined) {
      this.clientConfig.qidoUrlPrefix = server.qidoPathPrefix
    }
    if (server.wadoPathPrefix !== undefined) {
      this.clientConfig.wadoUrlPrefix = server.wadoPathPrefix
    }
    if (server.stowPathPrefix !== undefined) {
      this.clientConfig.stowUrlPrefix = server.stowPathPrefix
    }

    // if (props.keycloak !== undefined) {
    //   props.keycloak.loadUserProfile().then(
    //     (profile: KeycloakProfile): void => {
    //       if (profile.username !== undefined) {
    //         console.debug(`authenticated user "${profile.username}"`)
    //       }
    //       let name = ''
    //       if (profile.firstName !== undefined) {
    //         name += profile.firstName
    //       }
    //       if (profile.lastName !== undefined) {
    //         name += ` ${profile.lastName}`
    //       }
    //       // @ts-expect-error
    //       this.setState(state => ({
    //         user: {
    //           name: name,
    //           username: profile.username,
    //           email: profile.email
    //         }
    //       }))
    //     }
    //   ).catch(response => console.error(response))

    //   if (props.keycloak.token !== undefined) {
    //     this.clientConfig.headers = {
    //       Authorization: `Bearer ${props.keycloak.token}`
    //     }
    //   }

    //   this.tokenRefresher = setInterval(
    //     () => {
    //       if (props.keycloak !== undefined) {
    //         console.info('refresh token...')
    //         props.keycloak.updateToken(70).then(
    //           (refreshed: boolean) => {
    //             if (refreshed !== undefined && props.keycloak !== undefined) {
    //               console.debug('token refreshed')
    //               const token = props.keycloak.token
    //               if (token !== undefined) {
    //                 this.clientConfig.headers.Authorization = `Bearer ${token}`
    //                 this.setState(state => ({
    //                   client: new dwc.api.DICOMwebClient(this.clientConfig)
    //                 }))
    //               }
    //             } else {
    //               console.warn('token not refreshed, still valid')
    //             }
    //           }
    //         ).catch(
    //           (): void => console.error('failed to refresh token')
    //         )
    //       }
    //     },
    //     10000
    //   )
    // }

    this.state = {
      client: new dwc.api.DICOMwebClient(this.clientConfig)
    }
  }

  componentDidMount (): void {
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

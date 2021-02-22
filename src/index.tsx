import Keycloak from 'keycloak-js'
import React from 'react'
import ReactDOM from 'react-dom'
import { message } from 'antd'
import './index.css'
import App from './BrightField'

if (process.env.REACT_APP_REQUIRES_AUTH === 'false') {
  ReactDOM.render(
    <React.StrictMode>
      <App
        dicomwebUrl={process.env.REACT_APP_DICOMWEB_URL}
        dicomwebPath={process.env.REACT_APP_DICOMWEB_PATH}
        qidoPathPrefix={process.env.REACT_APP_DICOMWEB_QIDO_PATH_PREFIX}
        wadoPathPrefix={process.env.REACT_APP_DICOMWEB_WADO_PATH_PREFIX}
      />
    </React.StrictMode>,
    document.getElementById('root')
  )
} else {
  console.info('authenticate...')
  const keycloak = Keycloak(window.location.origin + '/keycloak.json')
  keycloak
    .init({
      onLoad: 'login-required',
      flow: 'standard'
    })
    .then((authenticated: boolean): void => {
      if (!authenticated) {
        console.error('Keycloak initialization failed')
        return
      }

      ReactDOM.render(
        <React.StrictMode>
          <App
            dicomwebUrl={process.env.REACT_APP_DICOMWEB_URL}
            dicomwebPath={process.env.REACT_APP_DICOMWEB_PATH}
            qidoPathPrefix={process.env.REACT_APP_DICOMWEB_QIDO_PATH_PREFIX}
            wadoPathPrefix={process.env.REACT_APP_DICOMWEB_WADO_PATH_PREFIX}
            keycloak={keycloak}
          />
        </React.StrictMode>,
        document.getElementById('root')
      )
    })
    .catch((): void => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error('not authenticated')
      window.location.reload()
    })
}

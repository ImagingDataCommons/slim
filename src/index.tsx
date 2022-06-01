import React from 'react'
import ReactDOM from 'react-dom'

import './index.css'
import AppConfig from './AppConfig'

import packageInfo from '../package.json'

declare global {
  interface Window {
    config: any
  }
}

const config: AppConfig = window.config
if (config === undefined) {
  throw Error('No application configuration was provided.')
}

let App
if (config.mode === 'dark') {
  App = React.lazy(async () => await import('./AppDark'))
} else {
  App = React.lazy(async () => await import('./AppLight'))
}

ReactDOM.render(
  <React.StrictMode>
    <React.Suspense fallback={<div>Loading application...</div>}>
      <App
        config={config}
        version={packageInfo.version}
        name={packageInfo.name}
        homepage='https://github.com/herrmannlab/slim'
      />
    </React.Suspense>
  </React.StrictMode>,
  document.getElementById('root')
)

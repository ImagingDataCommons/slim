import React from 'react'
import ReactDOM from 'react-dom'

import './index.css'
import AppConfig from './AppConfig'
import App from './App'

import { version } from '../package.json'

declare global {
  interface Window {
    config: any
  }
}

const config: AppConfig = window.config

if (config === undefined) {
  throw Error('No application configuration was provided.')
}

ReactDOM.render(
  <React.StrictMode>
    <App config={config} version={version} />
  </React.StrictMode>,
  document.getElementById('root')
)

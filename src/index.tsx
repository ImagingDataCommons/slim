import React from 'react'
import { createRoot } from 'react-dom/client'
import { message } from 'antd'

import './index.css'
import AppConfig from './AppConfig'

import packageInfo from '../package.json'
import CustomErrorBoundary from './components/CustomErrorBoundary'

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

message.config({
  top: 100
})

const container = document.getElementById('root')
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(container!)
root.render(
  /// / <React.StrictMode>
  <React.Suspense fallback={<div>Loading application...</div>}>
    <CustomErrorBoundary context='App'>
      <App
        config={config}
        version={packageInfo.version}
        name={packageInfo.name}
        homepage='https://github.com/ImagingDataCommons/slim'
      />
    </CustomErrorBoundary>
  </React.Suspense>
// </React.StrictMode>
)

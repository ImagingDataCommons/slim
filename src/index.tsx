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

const isMessageTypeDisabled = ({ type }: { type: string }): boolean => {
  const { messages } = config
  if (messages === undefined) return false
  if (typeof messages.disabled === 'boolean') {
    return messages.disabled
  }
  return Array.isArray(messages.disabled) && messages.disabled.includes(type)
}

// Store original message methods
const originalMessage = { ...message }

/** Create a proxy to control antd message */
const messageProxy = new Proxy(originalMessage, {
  get (target, prop: PropertyKey) {
    if (prop === 'config') {
      return message.config.bind(message)
    }
    if (typeof target[prop as keyof typeof target] === 'function') {
      return (...args: any[]) => {
        const isMessageEnabled = isMessageTypeDisabled({ type: prop as string })
        if (!isMessageEnabled) {
          return (target[prop as keyof typeof target] as Function).apply(message, args)
        }
        return { then: () => {} }
      }
    }
    return Reflect.get(target, prop)
  }
})
Object.assign(message, messageProxy)

message.config({
  top: config.messages?.top ?? 100,
  duration: config.messages?.duration ?? 5
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

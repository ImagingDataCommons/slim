import { message } from 'antd'
import React from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'

import packageInfo from '../package.json'
import type AppConfig from './AppConfig'
import CustomErrorBoundary from './components/CustomErrorBoundary'

declare global {
  interface Window {
    config: AppConfig
  }
}

const config: AppConfig = window.config
if (config === undefined) {
  throw Error('No application configuration was provided.')
}

type AppProps = {
  config: AppConfig
  version: string
  name: string
  homepage: string
}
let App: React.LazyExoticComponent<React.ComponentType<AppProps>>
if (config.mode === 'dark') {
  App = React.lazy(
    async () => await import('./AppDark'),
  ) as React.LazyExoticComponent<React.ComponentType<AppProps>>
} else {
  App = React.lazy(
    async () => await import('./AppLight'),
  ) as React.LazyExoticComponent<React.ComponentType<AppProps>>
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

const createMessageConfig = (content: string | object): object => {
  const duration = config.messages?.duration ?? 5

  if (
    typeof content === 'object' &&
    content !== null &&
    content !== undefined
  ) {
    return {
      ...content,
      duration,
    }
  }

  return {
    content,
    duration,
  }
}

/** Create a proxy to control antd message */
const messageProxy = new Proxy(originalMessage, {
  get(target, prop: PropertyKey) {
    // Handle config method separately
    if (prop === 'config') {
      return message.config.bind(message)
    }

    // Handle message methods (success, error, etc)
    const method = target[prop as keyof typeof target]
    if (typeof method === 'function') {
      return (...args: unknown[]) => {
        const isMessageEnabled = !isMessageTypeDisabled({
          type: prop as string,
        })
        if (isMessageEnabled) {
          const messageConfig = createMessageConfig(args[0] as string | object)
          return (method as (arg: object) => unknown).apply(message, [
            messageConfig,
          ])
        }
        return Promise.resolve()
      }
    }

    // Pass through any other properties
    return Reflect.get(target, prop)
  },
})

// Apply the proxy
Object.assign(message, messageProxy)

// Set global config after proxy is in place
message.config({
  top: config.messages?.top ?? 100,
  duration: config.messages?.duration ?? 5,
})

const container = document.getElementById('root')
if (container == null) {
  throw new Error('Root element not found')
}
const root = createRoot(container)
root.render(
  /// / <React.StrictMode>
  <React.Suspense fallback={<div>Loading application...</div>}>
    <CustomErrorBoundary context="App">
      <App
        config={config}
        version={packageInfo.version}
        name={packageInfo.name}
        homepage="https://github.com/ImagingDataCommons/slim"
      />
    </CustomErrorBoundary>
  </React.Suspense>,
  // </React.StrictMode>
)

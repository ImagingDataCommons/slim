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

const createMessageConfig = (content: string | object): object => {
  const duration = config.messages?.duration ?? 5

  if (typeof content === 'object' && content !== null) {
    return {
      ...content,
      duration
    }
  }

  return {
    content,
    duration
  }
}

/** Create a proxy to control antd message */
const messageProxy = new Proxy(originalMessage, {
  get (target, prop: PropertyKey) {
    // Handle config method separately
    if (prop === 'config') {
      return message.config.bind(message)
    }

    // Handle message methods (success, error, etc)
    const method = target[prop as keyof typeof target]
    if (typeof method === 'function') {
      return (...args: any[]) => {
        const isMessageEnabled = !isMessageTypeDisabled({ type: prop as string })
        if (isMessageEnabled) {
          const messageConfig = createMessageConfig(args[0])
          return (method as Function).apply(message, [messageConfig])
        }
        return { then: () => {} }
      }
    }

    // Pass through any other properties
    return Reflect.get(target, prop)
  }
})

// Apply the proxy
Object.assign(message, messageProxy)

// Set global config after proxy is in place
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

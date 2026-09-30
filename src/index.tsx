import React from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'

import packageInfo from '../package.json'
import App from './App'
import type AppConfig from './AppConfig'
import CustomErrorBoundary from './components/CustomErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'
import { StudySummaryProvider } from './contexts/StudySummaryContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { logger } from './utils/logger'

declare global {
  interface Window {
    config: AppConfig
  }
}

const config: AppConfig = window.config
if (config === undefined) {
  throw Error('No application configuration was provided.')
}

if (config.logger != null) {
  logger.configure({
    ...(config.logger.level != null
      ? { level: logger.parseLogLevel(config.logger.level) }
      : {}),
    ...(config.logger.enableInProduction != null
      ? { enableInProduction: config.logger.enableInProduction }
      : {}),
    ...(config.logger.enableInDevelopment != null
      ? { enableInDevelopment: config.logger.enableInDevelopment }
      : {}),
  })
}

const mountApp = (): void => {
  const container = document.getElementById('root')
  if (container == null) {
    throw new Error('Root element not found')
  }

  /** Determine initial theme from config or default to light */
  const initialTheme = config.mode === 'dark' ? 'dark' : 'light'

  const root = createRoot(container)
  root.render(
    <React.Suspense
      fallback={
        <div className="slim-app-loading">
          <div className="slim-app-loading-spinner" />
          <p className="slim-app-loading-label">Loading application...</p>
        </div>
      }
    >
      <CustomErrorBoundary context="App">
        <ThemeProvider defaultTheme={initialTheme}>
          <TooltipProvider delayDuration={300}>
            <StudySummaryProvider>
              <App
                config={config}
                version={packageInfo.version}
                name={packageInfo.name}
                homepage="https://github.com/ImagingDataCommons/slim"
              />
            </StudySummaryProvider>
          </TooltipProvider>
        </ThemeProvider>
      </CustomErrorBoundary>
    </React.Suspense>,
  )
}

/**
 * Silent renew reuses the app redirect_uri (no extra IdP registration).
 * When oidc-client loads that URI in a hidden iframe (success or error),
 * complete the callback here and skip mounting React so the iframe cannot
 * share/corrupt the parent sessionStorage OIDC state.
 */
void import('./auth/OidcManager')
  .then(async ({ completeSilentRenewIfFrame }) => {
    const handled = await completeSilentRenewIfFrame()
    if (!handled) {
      mountApp()
    }
  })
  .catch((error) => {
    console.error('failed to initialize auth bootstrap', error)
    mountApp()
  })

import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/400-italic.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import { createRoot } from 'react-dom/client'

import './index.css'

import packageInfo from '../package.json'
import type AppConfig from './AppConfig'
import { ConfigProblemsPage } from './app/ConfigProblemsPage'
import { findConfigProblems } from './app/configProblems'
import CustomErrorBoundary from './components/CustomErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'
import { StudySummaryProvider } from './contexts/StudySummaryContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastHost } from './features/viewer/components/ToastHost'
import { configureToasts } from './features/viewer/services/toast'
import { logger, parseLogLevel } from './utils/logger'

declare global {
  interface Window {
    config: AppConfig
  }
}

const config: AppConfig | undefined = window.config
const configProblems = findConfigProblems(
  config,
  import.meta.env.REACT_APP_CONFIG ?? 'local',
  window.location.pathname,
)

if (config?.logger != null) {
  logger.configure({
    ...(config.logger.level != null
      ? { level: parseLogLevel(config.logger.level) }
      : {}),
    ...(config.logger.enableInProduction != null
      ? { enableInProduction: config.logger.enableInProduction }
      : {}),
    ...(config.logger.enableInDevelopment != null
      ? { enableInDevelopment: config.logger.enableInDevelopment }
      : {}),
  })
}

configureToasts(config?.messages)

/**
 * Lazy-load App so the silent-renew iframe does not parse the full viewer
 * bundle when it only needs to complete the OIDC callback.
 */
const mountApp = async (): Promise<void> => {
  const container = document.getElementById('root')
  if (container == null) {
    throw new Error('Root element not found')
  }

  const initialTheme = config?.mode === 'light' ? 'light' : 'dark'
  const root = createRoot(container)

  if (config === undefined || configProblems.length > 0) {
    root.render(
      <CustomErrorBoundary context="App">
        <ThemeProvider defaultTheme={initialTheme}>
          <ConfigProblemsPage problems={configProblems} />
        </ThemeProvider>
      </CustomErrorBoundary>,
    )
    return
  }

  const { default: App } = await import('./App')
  root.render(
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
            <ToastHost top={config.messages?.top} />
          </StudySummaryProvider>
        </TooltipProvider>
      </ThemeProvider>
    </CustomErrorBoundary>,
  )
}

/**
 * Silent renew reuses the app redirect_uri (no extra IdP registration).
 * When a silent renew loads that URI in a hidden iframe (success or error),
 * complete the callback here and skip mounting React so the iframe cannot
 * share/corrupt the parent sessionStorage OIDC state.
 */
void import('./auth/OidcManager')
  .then(async ({ completeSilentRenewIfFrame }) => {
    const handled = await completeSilentRenewIfFrame()
    if (!handled) {
      await mountApp()
    }
  })
  .catch(async (error) => {
    logger.error('failed to initialize auth bootstrap', error)
    await mountApp()
  })

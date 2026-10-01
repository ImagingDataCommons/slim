import type { JSX } from 'react'
import { BrowserRouter } from 'react-router'
import type AppConfig from './AppConfig'
import { AppPage, type AppPageContext } from './app/AppPage'
import { AppRoutes } from './app/AppRoutes'
import { useAppSession } from './app/useAppSession'
import AppLoading from './components/AppLoading'
import InfoPage from './components/InfoPage'
import { buildAppInfo } from './utils/appInfo'

export interface AppProps {
  name: string
  homepage: string
  version: string
  config: AppConfig
}

function App({ name, homepage, version, config }: AppProps): JSX.Element {
  const { session, state } = useAppSession(config)

  const page: AppPageContext = {
    app: buildAppInfo({
      name,
      version,
      homepage,
      organization: config.organization,
    }),
    user: state.user,
    clients: state.clients,
    defaultClients: state.defaultClients,
    onServerSelection: session.selectServer,
  }

  if (state.isLoading) {
    return (
      <BrowserRouter basename={config.path}>
        <AppPage
          {...page}
          showWorklistButton={false}
          showServerSelectionButton={false}
          contentClassName="items-center justify-center"
        >
          <AppLoading fullscreen={false} label="Loading Slim" />
        </AppPage>
      </BrowserRouter>
    )
  }
  if (!state.wasAuthSuccessful) {
    return (
      <InfoPage
        type="error"
        message={state.signInFailureMessage ?? 'Sign-in failed.'}
      />
    )
  }
  if (state.error != null) {
    return <InfoPage type="error" message={state.error.message} />
  }
  return (
    <BrowserRouter basename={config.path}>
      <AppRoutes
        config={config}
        page={page}
        onUserLogout={session.auth != null ? session.signOut : undefined}
        recoveryKey={state.authRecoveryKey}
      />
    </BrowserRouter>
  )
}

export default App

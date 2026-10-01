import { Route, Routes } from 'react-router-dom'

import type AppConfig from '../AppConfig'
import { Worklist } from '../features/worklist'
import { RoutePaths } from '../utils/routes'
import { AppPage, type AppPageContext } from './AppPage'
import { ParametrizedCaseViewer } from './ParametrizedCaseViewer'

export interface AppRoutesProps {
  config: AppConfig
  page: AppPageContext
  onUserLogout?: () => void
  /** Changing it remounts every route */
  recoveryKey: number
}

export function AppRoutes({
  config,
  page,
  onUserLogout,
  recoveryKey,
}: AppRoutesProps): JSX.Element {
  const enableWorklist = !(config.disableWorklist ?? false)
  const enableServerSelection = config.enableServerSelection ?? false

  const worklist = enableWorklist ? (
    <Worklist clients={page.clients} />
  ) : (
    <div className="flex items-center justify-center h-full text-ink-muted">
      Worklist has been disabled.
    </div>
  )

  const caseViewerPage = (
    <AppPage
      {...page}
      showWorklistButton={enableWorklist}
      showServerSelectionButton={enableServerSelection}
      onUserLogout={onUserLogout}
    >
      <ParametrizedCaseViewer
        clients={page.clients}
        user={page.user}
        config={config}
        app={page.app}
      />
    </AppPage>
  )

  return (
    <Routes key={recoveryKey}>
      <Route
        path={RoutePaths.ROOT}
        element={
          <AppPage
            {...page}
            showWorklistButton={false}
            showServerSelectionButton={enableServerSelection}
            onUserLogout={onUserLogout}
          >
            {worklist}
          </AppPage>
        }
      />
      <Route path={RoutePaths.STUDY} element={caseViewerPage} />
      <Route path={RoutePaths.GCP_STUDY} element={caseViewerPage} />
      <Route
        path={RoutePaths.LOGOUT}
        element={
          <AppPage
            {...page}
            showWorklistButton={false}
            showServerSelectionButton={enableServerSelection}
            onUserLogout={onUserLogout}
            contentClassName="items-center justify-center text-ink-muted"
          >
            Logged out
          </AppPage>
        }
      />
    </Routes>
  )
}

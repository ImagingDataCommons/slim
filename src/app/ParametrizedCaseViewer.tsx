import type { JSX } from 'react'
import { Navigate, useParams } from 'react-router'

import type AppConfig from '../AppConfig'
import type { User } from '../auth'
import CaseViewer from '../components/CaseViewer'
import { ValidationProvider } from '../contexts/ValidationContext'
import type { AppInfo } from '../utils/appInfo'
import type { ClientMapping } from './clientMapping'

export interface ParametrizedCaseViewerProps {
  clients: ClientMapping
  user?: User
  app: AppInfo
  config: AppConfig
}

export function ParametrizedCaseViewer({
  clients,
  user,
  app,
  config,
}: ParametrizedCaseViewerProps): JSX.Element {
  const { studyInstanceUID } = useParams()

  if (studyInstanceUID === undefined) {
    return <Navigate to="/" replace />
  }

  const enableAnnotationTools = !(config.disableAnnotationTools ?? false)
  const preload = config.preload ?? false
  return (
    <ValidationProvider clients={clients} studyInstanceUID={studyInstanceUID}>
      <CaseViewer
        clients={clients}
        user={user}
        annotations={config.annotations}
        preload={preload}
        app={app}
        enableAnnotationTools={enableAnnotationTools}
        enableMemoryMonitoring={config.enableMemoryMonitoring ?? true}
        studyInstanceUID={studyInstanceUID}
      />
    </ValidationProvider>
  )
}

import type { JSX, ReactNode } from 'react'

import type { User } from '../auth'
import AppShell from '../components/AppShell'
import { Header, type ServerSelectionParams } from '../features/header'
import type { AppInfo } from '../utils/appInfo'
import type { ClientMapping } from './clientMapping'

const PAGE_CONTENT_CLASS_NAME =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'

export interface PageOptions {
  showWorklistButton: boolean
  showServerSelectionButton: boolean
  onUserLogout?: () => void
  /** Appended to the content container's base classes */
  contentClassName?: string
}

/** Header inputs shared by every page */
export interface AppPageContext {
  app: AppInfo
  user?: User
  clients: ClientMapping
  defaultClients: ClientMapping
  onServerSelection: (params: ServerSelectionParams) => void
}

export interface AppPageProps extends AppPageContext, PageOptions {
  children: ReactNode
}

/** App shell with the header above `children` */
export function AppPage({
  app,
  user,
  clients,
  defaultClients,
  onServerSelection,
  showWorklistButton,
  showServerSelectionButton,
  onUserLogout,
  contentClassName,
  children,
}: AppPageProps): JSX.Element {
  return (
    <AppShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          app={app}
          user={user}
          showWorklistButton={showWorklistButton}
          onServerSelection={onServerSelection}
          onUserLogout={onUserLogout}
          showServerSelectionButton={showServerSelectionButton}
          clients={clients}
          defaultClients={defaultClients}
        />
        <div
          className={[PAGE_CONTENT_CLASS_NAME, contentClassName]
            .filter((className) => className !== undefined)
            .join(' ')}
        >
          {children}
        </div>
      </div>
    </AppShell>
  )
}

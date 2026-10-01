import type * as React from 'react'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import type { User } from '../../../auth'
import { SlimLogoMark } from '../../../components/slim/SlimLogoMark'
import { Icon } from '../../../components/ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
import { useStudySummary } from '../../../contexts/StudySummaryContext'
import type DicomWebManager from '../../../DicomWebManager'
import { cn } from '../../../lib/utils'
import { isViewerPath, parseSeriesInstanceUID } from '../../../utils/routes'
import { useNotifications } from '../hooks/useNotifications'
import {
  type ServerSelectionParams,
  useServerSelection,
} from '../hooks/useServerSelection'
import { DebugDialog } from './dialogs/DebugDialog'
import { DicomTagBrowserDialog } from './dialogs/DicomTagBrowserDialog'
import type { PreferencesTab } from './dialogs/PreferencesDialog'
import { PreferencesDialog } from './dialogs/PreferencesDialog'
import { ServerSelectionDialog } from './dialogs/ServerSelectionDialog'
import { UserMenu } from './UserMenu'

export interface HeaderAppInfo {
  name: string
  version: string
  homepage: string
  uid: string
  organization?: string
}

interface HeaderProps {
  app: HeaderAppInfo
  user?: User
  clients?: { [key: string]: DicomWebManager }
  defaultClients?: { [key: string]: DicomWebManager }
  showWorklistButton: boolean
  onServerSelection: (params: ServerSelectionParams) => void
  onUserLogout?: () => void
  showServerSelectionButton: boolean
}

function HeaderIconButton({
  icon,
  title,
  onClick,
  badge,
}: {
  icon: string
  title: string
  onClick: () => void
  badge?: number
}): React.ReactElement {
  const hasBadge = badge !== undefined && badge > 0
  return (
    <button
      type="button"
      title={title}
      aria-label={hasBadge ? `${title} (${badge})` : title}
      onClick={onClick}
      className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-secondary transition-colors hover:bg-app hover:text-ink"
    >
      <Icon name={icon} size={20} />
      {hasBadge && (
        <span
          aria-hidden="true"
          className="absolute right-[3px] top-1 h-4 min-w-[16px] rounded-lg bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground shadow-[0_0_0_2px_rgb(var(--panel))]"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function HeaderDivider({
  className,
}: {
  className?: string
}): React.ReactElement {
  return <div className={cn('h-[22px] w-px flex-none bg-line', className)} />
}

export function Header({
  app,
  user,
  clients,
  defaultClients,
  showWorklistButton,
  onServerSelection,
  onUserLogout,
  showServerSelectionButton,
}: HeaderProps): React.ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ studyInstanceUID?: string }>()
  const { summary } = useStudySummary()

  const {
    serverUrl,
    mode: serverMode,
    isDialogOpen: isServerDialogOpen,
    isValid: isServerSelectionValid,
    oidcConfigInput,
    isOidcConfigValid,
    isServerUrlValid,
    openDialog: openServerDialog,
    cancelDialog: cancelServerDialog,
    setServerUrl,
    setMode: setServerMode,
    setOidcConfigInput,
    submitSelection: submitServerSelection,
  } = useServerSelection({ onServerSelection })

  const { errors, errorCategories, warnings, errorCount, warningCount } =
    useNotifications({ resetKey: location.pathname })

  const [isDebugDialogOpen, setIsDebugDialogOpen] = useState(false)
  const [isTagBrowserOpen, setIsTagBrowserOpen] = useState(false)
  const [preferencesTab, setPreferencesTab] = useState<PreferencesTab | null>(
    null,
  )

  const currentServerUrl =
    clients?.default?.baseURL ?? defaultClients?.default?.baseURL ?? serverUrl
  const defaultServerUrl = defaultClients?.default?.baseURL
  const isInViewer = isViewerPath(location.pathname)
  const studyInstanceUID = params.studyInstanceUID
  const issueCount = errorCount + warningCount

  const serverPillContent = (
    <>
      <span className="h-[7px] w-[7px] flex-none rounded-full bg-success" />
      <span className="truncate font-mono text-[12px]">{currentServerUrl}</span>
    </>
  )
  const serverPillClassName =
    'flex min-w-0 max-w-[420px] items-center gap-2 rounded-full border border-line bg-subtle py-[5px] pl-2 pr-2.5 text-ink-secondary'

  return (
    <>
      <header className="flex h-header flex-none items-center gap-4 border-b border-line bg-panel pl-5 pr-3">
        <div className="flex flex-none items-center gap-2.5">
          <div className="h-7 w-7 overflow-hidden rounded-[7px] bg-brand text-white">
            <SlimLogoMark className="h-full w-full" />
          </div>
          <div className="text-[15px] font-semibold leading-none tracking-[-0.01em] text-ink">
            Slim
          </div>
          <div className="rounded border border-line px-1.5 py-[3px] font-mono text-[11px] font-medium leading-none text-ink-muted">
            v{app.version}
          </div>
        </div>

        <HeaderDivider />

        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {showWorklistButton && (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex flex-none items-center gap-1.5 rounded-md px-2 py-1.5 font-medium text-ink-secondary transition-colors hover:bg-app hover:text-ink"
            >
              <Icon name="format_list_bulleted" size={18} />
              Worklist
            </button>
          )}
          {isInViewer && summary !== null && (
            <>
              {showWorklistButton && (
                <Icon
                  name="chevron_right"
                  size={16}
                  className="text-ink-fainter"
                />
              )}
              {summary.patientName !== undefined && (
                <span className="truncate whitespace-nowrap font-semibold text-ink">
                  {summary.patientName}
                </span>
              )}
              {summary.studyLabel !== undefined && (
                <span className="whitespace-nowrap font-mono text-[12px] text-ink-muted">
                  {summary.studyLabel}
                </span>
              )}
            </>
          )}
        </nav>

        <div className="flex min-w-0 flex-1 justify-center">
          {currentServerUrl !== undefined && currentServerUrl !== '' && (
            <Tooltip>
              <TooltipTrigger asChild>
                {showServerSelectionButton ? (
                  <button
                    type="button"
                    aria-label={`Server ${currentServerUrl}. Change server`}
                    onClick={openServerDialog}
                    className={cn(
                      serverPillClassName,
                      'hover:border-line-hover',
                    )}
                  >
                    {serverPillContent}
                  </button>
                ) : (
                  <div className={serverPillClassName}>{serverPillContent}</div>
                )}
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-[min(640px,90vw)] px-2.5 py-1.5"
              >
                <div className="break-all font-mono text-[11.5px] leading-[1.45]">
                  {currentServerUrl}
                </div>
                {showServerSelectionButton && (
                  <div className="mt-1 text-[11px] font-normal opacity-70">
                    Click to change or copy the server
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex flex-none items-center gap-0.5">
          <HeaderIconButton
            icon="bug_report"
            title="Debug info"
            badge={issueCount}
            onClick={() => setIsDebugDialogOpen(true)}
          />
          {isInViewer &&
            studyInstanceUID !== undefined &&
            clients !== undefined && (
              <HeaderIconButton
                icon="manage_search"
                title="DICOM tag browser"
                onClick={() => setIsTagBrowserOpen(true)}
              />
            )}
          {showServerSelectionButton && (
            <HeaderIconButton
              icon="dns"
              title="Select server"
              onClick={openServerDialog}
            />
          )}
          <HeaderDivider className="mx-2" />
          <UserMenu
            user={user}
            organization={app.organization}
            onOpenPreferences={setPreferencesTab}
            onLogout={onUserLogout}
          />
        </div>
      </header>

      <PreferencesDialog
        open={preferencesTab !== null}
        onOpenChange={(open) => {
          if (!open) setPreferencesTab(null)
        }}
        app={app}
        initialTab={preferencesTab ?? 'general'}
      />

      <DebugDialog
        open={isDebugDialogOpen}
        onOpenChange={setIsDebugDialogOpen}
        errors={errors}
        errorCategories={errorCategories}
        warnings={warnings}
      />

      {isInViewer &&
        studyInstanceUID !== undefined &&
        clients !== undefined && (
          <DicomTagBrowserDialog
            open={isTagBrowserOpen}
            onOpenChange={setIsTagBrowserOpen}
            clients={clients}
            studyInstanceUID={studyInstanceUID}
            seriesInstanceUID={parseSeriesInstanceUID(location.pathname)}
            subtitle={[summary?.patientName, summary?.studyLabel]
              .filter((part) => part !== undefined && part !== '')
              .join(' · ')}
          />
        )}

      <ServerSelectionDialog
        open={isServerDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelServerDialog()
        }}
        serverUrl={serverUrl}
        currentServerUrl={currentServerUrl}
        defaultServerUrl={defaultServerUrl}
        mode={serverMode}
        isValid={isServerSelectionValid}
        isServerUrlValid={isServerUrlValid}
        oidcConfigInput={oidcConfigInput}
        isOidcConfigValid={isOidcConfigValid}
        onServerUrlChange={setServerUrl}
        onModeChange={setServerMode}
        onOidcConfigChange={setOidcConfigInput}
        onSubmit={submitServerSelection}
        onCancel={cancelServerDialog}
      />
    </>
  )
}

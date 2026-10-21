import type * as React from 'react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import type { User } from '../../../auth'
import { SlimLogoMark } from '../../../components/slim/SlimLogoMark'
import { Button } from '../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { Icon, type IconName } from '../../../components/ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
import { useLayoutMode } from '../../../contexts/LayoutModeContext'
import { useStudySummary } from '../../../contexts/StudySummaryContext'
import type DicomWebManager from '../../../DicomWebManager'
import { cn } from '../../../lib/utils'
import type { AppInfo } from '../../../utils/appInfo'
import { isViewerPath, parseSeriesInstanceUID } from '../../../utils/routes'
import { PreferencesDialog, type PreferencesTab } from '../../preferences'
import { useCustomLogo } from '../hooks/useCustomLogo'
import {
  notificationResetKey,
  useNotifications,
} from '../hooks/useNotifications'
import {
  type ServerSelectionParams,
  useServerSelection,
} from '../hooks/useServerSelection'
import { customLogoUrl } from '../utils/customLogo'
import { DebugDialog } from './dialogs/DebugDialog'
import { DicomTagBrowserDialog } from './dialogs/DicomTagBrowserDialog'
import { ServerSelectionDialog } from './dialogs/ServerSelectionDialog'
import { UserMenu } from './UserMenu'

export interface HeaderProps {
  app: AppInfo
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
  compact,
}: {
  icon: IconName
  title: string
  onClick: () => void
  badge?: number
  compact: boolean
}): React.ReactElement {
  const hasBadge = badge !== undefined && badge > 0
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      aria-label={hasBadge ? `${title} (${badge})` : title}
      onClick={onClick}
      className={cn('relative', compact && 'min-h-11 min-w-11')}
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
    </Button>
  )
}

function HeaderDivider({
  className,
}: {
  className?: string
}): React.ReactElement {
  return <div className={cn('h-[22px] w-px flex-none bg-line', className)} />
}

function headerCrumbText(
  patientName: string | undefined,
  studyLabel: string | undefined,
): string {
  const name = patientName?.trim() ?? ''
  const label = studyLabel?.trim() ?? ''
  if (name !== '' && (label === name || label.startsWith(`${name} ·`))) {
    return label
  }
  return [name, label].filter((part) => part !== '').join(' · ')
}

function HeaderCrumb({
  patientName,
  studyLabel,
}: {
  patientName?: string
  studyLabel?: string
}): React.ReactElement {
  const crumb = headerCrumbText(patientName, studyLabel)
  const name = patientName?.trim() ?? ''
  if (name !== '' && crumb.startsWith(`${name} ·`)) {
    return (
      <>
        <span className="font-semibold text-ink">{name}</span>
        <span className="font-mono text-12 font-normal text-ink-muted">
          {crumb.slice(name.length)}
        </span>
      </>
    )
  }
  return <span className="font-semibold text-ink">{crumb}</span>
}

function HeaderOverflowMenu({
  issueCount,
  onDebug,
  onTags,
  onServer,
}: {
  issueCount: number
  onDebug: () => void
  onTags?: () => void
  onServer?: () => void
}): React.ReactElement {
  const hasBadge = issueCount > 0
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="More"
          aria-label={hasBadge ? `More (${issueCount})` : 'More'}
          className="relative min-h-11 min-w-11"
        >
          <Icon name="more_vert" size={20} />
          {hasBadge && (
            <span
              aria-hidden="true"
              className="absolute right-[3px] top-1 h-4 min-w-[16px] rounded-lg bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground shadow-[0_0_0_2px_rgb(var(--panel))]"
            >
              {issueCount > 99 ? '99+' : issueCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-56">
        <DropdownMenuItem onSelect={onDebug}>
          <Icon name="bug_report" size={18} className="text-ink-secondary" />
          Debug info
          {hasBadge && (
            <span className="ml-auto text-12 text-ink-muted">{issueCount}</span>
          )}
        </DropdownMenuItem>
        {onTags !== undefined && (
          <DropdownMenuItem onSelect={onTags}>
            <Icon
              name="manage_search"
              size={18}
              className="text-ink-secondary"
            />
            DICOM tag browser
          </DropdownMenuItem>
        )}
        {onServer !== undefined && (
          <DropdownMenuItem onSelect={onServer}>
            <Icon name="dns" size={18} className="text-ink-secondary" />
            Select server
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
  const params = useParams<{ studyInstanceUID?: string }>()
  const { summary } = useStudySummary()

  const serverSelection = useServerSelection({ onServerSelection })
  const { serverUrl, openDialog: openServerDialog } = serverSelection

  const { errors, warnings, errorCount, warningCount } = useNotifications({
    resetKey: notificationResetKey(
      location.pathname,
      params.studyInstanceUID,
      isViewerPath(location.pathname),
    ),
  })

  const customLogo = useCustomLogo(customLogoUrl(import.meta.env.BASE_URL))
  const [failedLogo, setFailedLogo] = useState<string | undefined>(undefined)

  const [isDebugDialogOpen, setIsDebugDialogOpen] = useState(false)
  const [isTagBrowserOpen, setIsTagBrowserOpen] = useState(false)
  const [preferencesTab, setPreferencesTab] = useState<PreferencesTab | null>(
    null,
  )

  const { compactChrome } = useLayoutMode()
  const currentServerUrl =
    clients?.default?.baseURL ?? defaultClients?.default?.baseURL ?? serverUrl
  /** A default server left blank for server selection */
  const hasServer = (currentServerUrl ?? '') !== ''
  const defaultServerUrl = defaultClients?.default?.baseURL
  const isInViewer = isViewerPath(location.pathname)
  const studyInstanceUID = params.studyInstanceUID
  const issueCount = errorCount + warningCount
  const crumbText = headerCrumbText(summary?.patientName, summary?.studyLabel)
  const canOpenTagBrowser =
    isInViewer && studyInstanceUID !== undefined && clients !== undefined

  const serverPillContent = (
    <>
      <span
        className={cn(
          'h-[7px] w-[7px] flex-none rounded-full',
          hasServer ? 'bg-success' : 'bg-ink-faint',
        )}
      />
      <span className={cn('truncate text-12', hasServer && 'font-mono')}>
        {hasServer ? currentServerUrl : 'No server selected'}
      </span>
    </>
  )
  const serverPillClassName =
    'flex min-w-0 max-w-[420px] items-center gap-2 rounded-full border border-line bg-subtle py-[5px] pl-2 pr-2.5 text-ink-secondary'

  return (
    <>
      <header
        className={cn(
          'z-20 flex h-header flex-none items-center border-b border-line bg-panel pt-[env(safe-area-inset-top)]',
          compactChrome
            ? 'gap-1 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]'
            : 'gap-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]',
        )}
      >
        <div className="flex flex-none items-center gap-2">
          {customLogo !== undefined && customLogo !== failedLogo ? (
            <img
              src={customLogo}
              alt="Slim"
              className={cn(
                'block h-8 w-auto object-contain',
                compactChrome ? 'max-w-8' : 'max-w-[240px]',
              )}
              onError={() => setFailedLogo(customLogo)}
            />
          ) : (
            <>
              <div className="h-6 w-6 overflow-hidden rounded-[6px] bg-brand text-white">
                <SlimLogoMark className="h-full w-full" />
              </div>
              {!compactChrome && (
                <div className="text-[15px] font-semibold leading-none tracking-[-0.01em] text-ink">
                  Slim
                </div>
              )}
            </>
          )}
          {!compactChrome && (
            <div className="rounded-sm border border-line px-1.5 py-[3px] font-mono text-11 font-medium leading-none text-ink-muted">
              v{app.version}
            </div>
          )}
        </div>

        {!compactChrome && <HeaderDivider />}

        <nav
          className={cn(
            'flex min-w-0 items-center text-13',
            compactChrome ? 'flex-1 gap-0.5' : 'gap-1.5',
          )}
        >
          {showWorklistButton && (
            <Button
              asChild
              variant="ghost"
              className={cn(
                'h-auto flex-none rounded-md px-2 py-1.5',
                compactChrome && 'min-h-11 min-w-11 px-0',
              )}
            >
              <Link to="/" aria-label="Worklist">
                <Icon name="format_list_bulleted" size={18} />
                {!compactChrome && 'Worklist'}
              </Link>
            </Button>
          )}
          {isInViewer && crumbText !== '' && (
            <>
              {showWorklistButton && (
                <Icon
                  name="chevron_right"
                  size={16}
                  className="flex-none text-ink-fainter"
                />
              )}
              <p title={crumbText} className="min-w-0 flex-1 truncate">
                <HeaderCrumb
                  patientName={summary?.patientName}
                  studyLabel={summary?.studyLabel}
                />
              </p>
            </>
          )}
        </nav>

        {!compactChrome && (
          <div className="flex min-w-0 flex-1 justify-center">
            {showServerSelectionButton && currentServerUrl !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={
                      hasServer
                        ? `Server ${currentServerUrl}. Change server`
                        : 'No server selected. Select a server'
                    }
                    onClick={openServerDialog}
                    className={cn(
                      serverPillClassName,
                      'hover:border-line-hover',
                    )}
                  >
                    {serverPillContent}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-[min(640px,90vw)] px-2.5 py-1.5"
                >
                  {hasServer ? (
                    <>
                      <div className="break-all font-mono text-11.5 leading-[1.45]">
                        {currentServerUrl}
                      </div>
                      <div className="mt-1 text-11 font-normal opacity-70">
                        Click to change or copy the server
                      </div>
                    </>
                  ) : (
                    <div className="text-11.5">Click to select a server</div>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        <div className="flex flex-none items-center gap-0.5">
          {compactChrome ? (
            <HeaderOverflowMenu
              issueCount={issueCount}
              onDebug={() => setIsDebugDialogOpen(true)}
              onTags={
                canOpenTagBrowser ? () => setIsTagBrowserOpen(true) : undefined
              }
              onServer={
                showServerSelectionButton ? openServerDialog : undefined
              }
            />
          ) : (
            <>
              <HeaderIconButton
                icon="bug_report"
                title="Debug info"
                badge={issueCount}
                compact={false}
                onClick={() => setIsDebugDialogOpen(true)}
              />
              {canOpenTagBrowser && (
                <HeaderIconButton
                  icon="manage_search"
                  title="DICOM tag browser"
                  compact={false}
                  onClick={() => setIsTagBrowserOpen(true)}
                />
              )}
              {showServerSelectionButton && (
                <HeaderIconButton
                  icon="dns"
                  title="Select server"
                  compact={false}
                  onClick={openServerDialog}
                />
              )}
              <HeaderDivider className="mx-2" />
            </>
          )}
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
            subtitle={crumbText}
          />
        )}

      <ServerSelectionDialog
        selection={serverSelection}
        defaultServerUrl={defaultServerUrl}
      />
    </>
  )
}

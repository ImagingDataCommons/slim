import type React from 'react'
import { useEffect, useRef, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { Icon, type IconName } from '../../../components/ui/icon'
import { cn } from '../../../lib/utils'
import { formatShortcutHint } from '../../../utils/keyboardShortcuts'
import type { ActiveRoiTool } from '../utils/activeRoiTool'
import { SLIDE_PANEL_ID, STUDY_PANEL_ID } from '../utils/panelIds'

/** Below this toolbar width the tool labels collapse to icons only. */
export const COMPACT_TOOLBAR_WIDTH_PX = 720

interface ToolDefinition {
  key: string
  icon: IconName
  label: string
  tooltip: string
  isActive: boolean
  onClick: () => void
}

export interface ViewerToolbarProps {
  isLeftPanelOpen: boolean
  onToggleLeftPanel?: () => void
  isRightPanelOpen: boolean
  onToggleRightPanel: () => void
  enableAnnotationTools: boolean
  activeTool: ActiveRoiTool
  areRoisHidden: boolean
  onSelect: () => void
  onDraw: () => void
  onModify: () => void
  onTranslate: () => void
  onRemove: () => void
  onToggleRoiVisibility: () => void
  onSave: () => void
  onGoTo: () => void
  variant?: 'desktop' | 'overlay'
  /** Tile status shown on the overlay bottom bar */
  status?: React.ReactNode
}

function PanelToggle({
  icon,
  title,
  isExpanded,
  controls,
  onClick,
  touch = false,
}: {
  icon: IconName
  title: string
  isExpanded: boolean
  controls: string
  onClick?: () => void
  touch?: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-expanded={isExpanded}
      aria-controls={controls}
      onClick={onClick}
      disabled={onClick === undefined}
      className={cn(
        'grid flex-none place-items-center rounded-lg text-ink-secondary transition-colors hover:bg-app disabled:pointer-events-none disabled:opacity-40',
        touch ? 'size-11' : 'size-8',
      )}
    >
      <Icon name={icon} size={19} />
    </button>
  )
}

function ToolButton({
  icon,
  label,
  tooltip,
  isActive,
  isCompact,
  onClick,
}: {
  icon: IconName
  label: string
  tooltip: string
  isActive: boolean
  isCompact: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={label}
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'flex h-7 flex-none items-center gap-1.5 rounded-md text-12.5 font-medium transition-colors hover:text-ink',
        isCompact ? 'px-1.5' : 'px-2',
        isActive
          ? 'bg-panel text-primary shadow-tool hover:text-primary'
          : 'text-ink-secondary',
      )}
    >
      <Icon name={icon} size={17} />
      {!isCompact && label}
    </button>
  )
}

/**
 * 40px viewer toolbar: study/slide panel toggles on the edges and the ROI
 * tool pill centered between them.
 */
export function ViewerToolbar({
  isLeftPanelOpen,
  onToggleLeftPanel,
  isRightPanelOpen,
  onToggleRightPanel,
  enableAnnotationTools,
  activeTool,
  areRoisHidden,
  onSelect,
  onDraw,
  onModify,
  onTranslate,
  onRemove,
  onToggleRoiVisibility,
  onSave,
  onGoTo,
  variant = 'desktop',
  status,
}: ViewerToolbarProps): React.ReactElement {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const element = toolbarRef.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? element.clientWidth
      setIsCompact(width < COMPACT_TOOLBAR_WIDTH_PX)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const tools: ToolDefinition[] = enableAnnotationTools
    ? [
        {
          key: 'select',
          icon: 'arrow_selector_tool',
          label: 'Select',
          tooltip: formatShortcutHint('select'),
          isActive: activeTool === 'select',
          onClick: onSelect,
        },
        {
          key: 'draw',
          icon: 'polyline',
          label: 'Draw',
          tooltip: formatShortcutHint('draw'),
          isActive: activeTool === 'draw',
          onClick: onDraw,
        },
        {
          key: 'modify',
          icon: 'touch_app',
          label: 'Modify',
          tooltip: formatShortcutHint('modify'),
          isActive: activeTool === 'modify',
          onClick: onModify,
        },
        {
          key: 'translate',
          icon: 'open_with',
          label: 'Translate',
          tooltip: formatShortcutHint('translate'),
          isActive: activeTool === 'translate',
          onClick: onTranslate,
        },
        {
          key: 'remove',
          icon: 'delete',
          label: 'Remove',
          tooltip: formatShortcutHint('remove'),
          isActive: false,
          onClick: onRemove,
        },
        {
          key: 'hide',
          icon: areRoisHidden ? 'visibility' : 'visibility_off',
          label: 'Hide',
          tooltip: formatShortcutHint('toggleRoiVisibility'),
          isActive: areRoisHidden,
          onClick: onToggleRoiVisibility,
        },
        {
          key: 'save',
          icon: 'save',
          label: 'Save',
          tooltip: formatShortcutHint('save'),
          isActive: false,
          onClick: onSave,
        },
      ]
    : []

  const studyToggle = (
    <PanelToggle
      icon={isLeftPanelOpen ? 'left_panel_close' : 'left_panel_open'}
      title="Toggle study panel"
      isExpanded={isLeftPanelOpen}
      controls={STUDY_PANEL_ID}
      onClick={onToggleLeftPanel}
      touch={variant === 'overlay'}
    />
  )
  const slideToggle = (
    <PanelToggle
      icon={isRightPanelOpen ? 'right_panel_close' : 'right_panel_open'}
      title="Toggle slide panel"
      isExpanded={isRightPanelOpen}
      controls={SLIDE_PANEL_ID}
      onClick={onToggleRightPanel}
      touch={variant === 'overlay'}
    />
  )
  const pressedTool = tools.find((tool) => tool.isActive)

  if (variant === 'overlay') {
    return (
      <div className="z-20 flex min-h-11 flex-none items-center gap-1 border-t border-line bg-panel px-2 pb-[env(safe-area-inset-bottom)]">
        {studyToggle}
        {tools.length > 0 && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Annotation tools"
                aria-label={
                  pressedTool === undefined
                    ? 'Annotation tools'
                    : `Annotation tools, ${pressedTool.label} active`
                }
                className={cn(
                  'grid size-11 flex-none place-items-center rounded-lg text-ink-secondary transition-colors hover:bg-app',
                  pressedTool !== undefined && 'text-primary',
                )}
              >
                <Icon name={pressedTool?.icon ?? 'polyline'} size={19} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              {tools.map((tool) => (
                <DropdownMenuItem
                  key={tool.key}
                  onSelect={tool.onClick}
                  className={cn(tool.isActive && 'text-primary')}
                >
                  <Icon name={tool.icon} size={17} />
                  {tool.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          type="button"
          title={formatShortcutHint('goTo')}
          aria-label="Go to"
          onClick={onGoTo}
          className="grid size-11 flex-none place-items-center rounded-lg text-ink-secondary transition-colors hover:bg-app"
        >
          <Icon name="my_location" size={19} />
        </button>
        {slideToggle}
        <span className="min-w-0 flex-1" />
        {status}
      </div>
    )
  }

  return (
    <div
      ref={toolbarRef}
      className="flex h-toolbar flex-none items-center gap-2 border-b border-line bg-panel px-2.5"
    >
      {studyToggle}
      <div className="h-5 w-px flex-none bg-line" />
      <div className="flex min-w-0 flex-1 justify-center overflow-hidden">
        <div className="flex min-w-0 items-center gap-0.5 rounded-lg bg-app p-0.5">
          {tools.map((tool) => (
            <ToolButton
              key={tool.key}
              icon={tool.icon}
              label={tool.label}
              tooltip={tool.tooltip}
              isActive={tool.isActive}
              isCompact={isCompact}
              onClick={tool.onClick}
            />
          ))}
          {tools.length > 0 && (
            <div className="mx-1 h-4 w-px flex-none bg-line-input" />
          )}
          <ToolButton
            icon="my_location"
            label="Go to"
            tooltip={formatShortcutHint('goTo')}
            isActive={false}
            isCompact={isCompact}
            onClick={onGoTo}
          />
        </div>
      </div>
      <div className="h-5 w-px flex-none bg-line" />
      {slideToggle}
    </div>
  )
}

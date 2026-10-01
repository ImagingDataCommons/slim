import type React from 'react'
import { useEffect, useRef, useState } from 'react'

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
  onDraw: () => void
  onModify: () => void
  onTranslate: () => void
  onRemove: () => void
  onToggleRoiVisibility: () => void
  onSave: () => void
  onGoTo: () => void
}

function PanelToggle({
  icon,
  title,
  isExpanded,
  controls,
  onClick,
}: {
  icon: IconName
  title: string
  isExpanded: boolean
  controls: string
  onClick?: () => void
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
      className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg text-ink-secondary transition-colors hover:bg-app disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon name={icon} size={20} />
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
        'flex h-8 flex-none items-center gap-1.5 rounded-[7px] text-[12.5px] font-medium transition-colors hover:text-ink',
        isCompact ? 'px-2' : 'px-2.5',
        isActive
          ? 'bg-panel text-primary shadow-tool hover:text-primary'
          : 'text-ink-secondary',
      )}
    >
      <Icon name={icon} size={19} />
      {!isCompact && label}
    </button>
  )
}

/**
 * 48px viewer toolbar: study/slide panel toggles on the edges and the ROI
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
  onDraw,
  onModify,
  onTranslate,
  onRemove,
  onToggleRoiVisibility,
  onSave,
  onGoTo,
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

  return (
    <div
      ref={toolbarRef}
      className="flex h-toolbar flex-none items-center gap-2 border-b border-line bg-panel px-2.5"
    >
      <PanelToggle
        icon={isLeftPanelOpen ? 'left_panel_close' : 'left_panel_open'}
        title="Toggle study panel"
        isExpanded={isLeftPanelOpen}
        controls={STUDY_PANEL_ID}
        onClick={onToggleLeftPanel}
      />
      <div className="h-[22px] w-px flex-none bg-line" />
      <div className="flex min-w-0 flex-1 justify-center overflow-hidden">
        <div className="flex min-w-0 items-center gap-0.5 rounded-[10px] bg-app p-[3px]">
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
            <div className="mx-1 h-5 w-px flex-none bg-line-input" />
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
      <div className="h-[22px] w-px flex-none bg-line" />
      <PanelToggle
        icon={isRightPanelOpen ? 'right_panel_close' : 'right_panel_open'}
        title="Toggle slide panel"
        isExpanded={isRightPanelOpen}
        controls={SLIDE_PANEL_ID}
        onClick={onToggleRightPanel}
      />
    </div>
  )
}

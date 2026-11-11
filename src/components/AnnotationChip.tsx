import type React from 'react'

import { cn } from '../lib/utils'
import type { AnnotationStyle } from '../types/layerStyles'
import { rgbToHex } from '../utils/color'
import { getToggleTarget, getVisibilityState } from '../utils/visibility'
import { formatVisibilitySummary } from '../utils/visibilitySummary'
import ColorSettingsMenu from './ColorSettingsMenu'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Switch } from './ui/switch'

interface VisibilityRowProps {
  visibleCount: number
  totalCount: number
  isChecked: boolean
  onToggle: () => void
  label: string
}

/** Visibility toggle row for the annotation popover. */
function VisibilityRow({
  visibleCount,
  totalCount,
  isChecked,
  onToggle,
  label,
}: VisibilityRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <span className="text-12.5 font-medium text-ink">
        Visible
        <span className="ml-1.5 font-normal text-ink-muted">
          {visibleCount} / {totalCount}
        </span>
      </span>
      <Switch
        size="sm"
        checked={isChecked}
        onCheckedChange={onToggle}
        aria-label={label}
      />
    </div>
  )
}

export interface AnnotationChipProps {
  /** Accessible name prefix and switch label, distinct for category chips */
  name: string
  meaning: string
  /** Second line of the popover heading */
  detail: string
  title: string
  uids: string[]
  isCategory?: boolean
  style: AnnotationStyle | undefined
  checkedAnnotationUids: Set<string>
  onVisibilityChange: (uids: string[], isVisible: boolean) => void
  onStylePreview: (uids: string[], style: AnnotationStyle) => void
  onStyleCommit: (uids: string[], style: AnnotationStyle) => void
}

/** A category or annotation type as a pill chip; clicking opens visibility and color settings. */
export function AnnotationChip({
  name,
  meaning,
  detail,
  title,
  uids,
  isCategory = false,
  style,
  checkedAnnotationUids,
  onVisibilityChange,
  onStylePreview,
  onStyleCommit,
}: AnnotationChipProps): React.ReactElement {
  const visibleCount = uids.filter((uid) =>
    checkedAnnotationUids.has(uid),
  ).length
  const visibility = getVisibilityState(uids, checkedAnnotationUids)
  const isVisible = visibility !== 'none'
  const color = style !== undefined ? rgbToHex(style.color) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          aria-label={`${name}, ${uids.length} annotations, ${formatVisibilitySummary(visibleCount, uids.length)}`}
          className={cn(
            'flex items-center gap-1.5 rounded-full border border-line py-1 pl-2 pr-2.5 text-12 text-ink transition-colors hover:border-line-hover',
            isCategory && 'bg-chip font-semibold',
            !isVisible && 'text-ink-muted',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 flex-none rounded-full',
              visibility === 'none' && 'opacity-40',
              visibility === 'some' && 'opacity-70 ring-1 ring-line-hover',
            )}
            style={{ background: color ?? 'rgb(var(--ink-faint))' }}
          />
          <span className="max-w-[140px] truncate">{meaning}</span>
          <span className="text-ink-muted">{uids.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-80">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-12.5 font-semibold text-ink">{meaning}</div>
            <div className="mt-0.5 font-mono text-11 text-ink-muted">
              {detail}
            </div>
          </div>
          <VisibilityRow
            visibleCount={visibleCount}
            totalCount={uids.length}
            isChecked={visibility === 'all'}
            onToggle={() =>
              onVisibilityChange(uids, getToggleTarget(visibility))
            }
            label={`Show all ${name}`}
          />
          {style !== undefined && (
            <ColorSettingsMenu
              style={style}
              onChange={(next) => onStylePreview(uids, next)}
              onCommit={(next) => onStyleCommit(uids, next)}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

import type React from 'react'
import { useState } from 'react'

import { cn } from '../lib/utils'
import type { AnnotationStyle } from '../types/layerStyles'
import {
  type Category,
  collectCategoryUids,
  type Type,
} from '../utils/annotationCategories'
import { rgbToHex } from '../utils/color'
import {
  computeBulkVisibility,
  getToggleTarget,
  getVisibilityState,
  type VisibilityChange,
} from '../utils/visibility'
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

/** Not every annotation UID has a style entry */
export type AnnotationStyleMap = Record<string, AnnotationStyle | undefined>

export type AnnotationStyleChangeHandler = (change: {
  uids: string[]
  styleOptions: AnnotationStyle
}) => void

export type AnnotationVisibilityChangeHandler = (
  changes: VisibilityChange[],
) => void

interface AnnotationChipProps {
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
function AnnotationChip({
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

export interface AnnotationCategoryItemProps {
  category: Category
  onChange: AnnotationVisibilityChangeHandler
  onStyleChange: AnnotationStyleChangeHandler
  defaultAnnotationStyles: AnnotationStyleMap
  checkedAnnotationUids: Set<string>
}

/** A chip for the whole category, then one chip per annotation type. */
function AnnotationCategoryItem({
  category,
  onChange,
  checkedAnnotationUids,
  onStyleChange,
  defaultAnnotationStyles,
}: AnnotationCategoryItemProps): React.ReactElement {
  /**
   * The viewer's style map is mutated in place, so the chips keep the styles
   * the user picked instead of relying on the map to re-render them.
   */
  const [editedStyles, setEditedStyles] = useState<AnnotationStyleMap>({})
  const styleOf = (uids: string[]): AnnotationStyle | undefined =>
    editedStyles[uids[0]] ?? defaultAnnotationStyles[uids[0]]

  const previewStyle = (uids: string[], style: AnnotationStyle): void => {
    setEditedStyles((styles) => ({
      ...styles,
      ...Object.fromEntries(uids.map((uid) => [uid, style])),
    }))
  }

  const commitStyle = (uids: string[], style: AnnotationStyle): void => {
    previewStyle(uids, style)
    onStyleChange({ uids, styleOptions: style })
  }

  const handleVisibilityChange = (uids: string[], isVisible: boolean): void => {
    const changes = computeBulkVisibility(
      uids,
      checkedAnnotationUids,
      isVisible,
    )
    if (changes.length > 0) onChange(changes)
  }

  const categoryCode = `${category.CodeValue}:${category.CodingSchemeDesignator}`
  const categoryUids = collectCategoryUids(category)

  return (
    <fieldset
      aria-label={category.CodeMeaning}
      className="flex flex-wrap items-center gap-1.5"
    >
      <AnnotationChip
        isCategory
        name={`${category.CodeMeaning} category`}
        meaning={category.CodeMeaning}
        detail={`All types · ${categoryCode}`}
        title={`${category.CodeMeaning} · ${categoryCode}`}
        uids={categoryUids}
        style={styleOf(categoryUids)}
        checkedAnnotationUids={checkedAnnotationUids}
        onVisibilityChange={handleVisibilityChange}
        onStylePreview={previewStyle}
        onStyleCommit={commitStyle}
      />
      {category.types.map((type: Type) => (
        <AnnotationChip
          key={`${type.CodingSchemeDesignator}:${type.CodeValue}:${type.CodeMeaning}`}
          name={type.CodeMeaning}
          meaning={type.CodeMeaning}
          detail={`${category.CodeMeaning} · ${type.CodeValue}:${type.CodingSchemeDesignator}`}
          title={`${category.CodeMeaning} · ${type.CodeMeaning}`}
          uids={type.uids}
          style={styleOf(type.uids)}
          checkedAnnotationUids={checkedAnnotationUids}
          onVisibilityChange={handleVisibilityChange}
          onStylePreview={previewStyle}
          onStyleCommit={commitStyle}
        />
      ))}
    </fieldset>
  )
}

export default AnnotationCategoryItem

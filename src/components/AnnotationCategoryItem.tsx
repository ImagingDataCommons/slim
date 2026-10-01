import type React from 'react'
import { useState } from 'react'

import { cn } from '../lib/utils'
import type { AnnotationStyle } from '../types/layerStyles'
import {
  type Category,
  getCategoryVisibility,
  type Type,
} from '../utils/annotationCategories'
import { rgbToHex } from '../utils/color'
import {
  computeBulkVisibility,
  getToggleTarget,
  type VisibilityChange,
} from '../utils/visibility'
import { formatVisibilitySummary } from '../utils/visibilitySummary'
import ColorSettingsMenu from './ColorSettingsMenu'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Switch } from './ui/switch'

/** Not every annotation UID has a style entry */
export type AnnotationStyleMap = Record<string, AnnotationStyle | undefined>

export type AnnotationStyleChangeHandler = (change: {
  uids: string[]
  styleOptions: AnnotationStyle
}) => void

export type AnnotationVisibilityChangeHandler = (
  changes: VisibilityChange[],
) => void

interface AnnotationTypeChipProps {
  category: Category
  type: Type
  checkedAnnotationUids: Set<string>
  onVisibilityChange: (type: Type, isVisible: boolean) => void
  onStyleChange: AnnotationStyleChangeHandler
  defaultAnnotationStyles: AnnotationStyleMap
}

/** One annotation type as a pill chip; clicking opens visibility and color settings. */
function AnnotationTypeChip({
  category,
  type,
  checkedAnnotationUids,
  onVisibilityChange,
  onStyleChange,
  defaultAnnotationStyles,
}: AnnotationTypeChipProps): React.ReactElement {
  const { CodeMeaning, CodingSchemeDesignator, CodeValue, uids } = type
  /**
   * The viewer's style map is mutated in place, so the chip keeps the style
   * the user picked instead of relying on the map to re-render it.
   */
  const [editedStyle, setEditedStyle] = useState<AnnotationStyle>()
  const style = editedStyle ?? defaultAnnotationStyles[uids[0]]
  const visibleCount = uids.filter((uid) =>
    checkedAnnotationUids.has(uid),
  ).length
  const visibility = getCategoryVisibility(type, checkedAnnotationUids)
  const isVisible = visibility !== 'none'
  const color = style !== undefined ? rgbToHex(style.color) : undefined

  const commitStyle = (next: AnnotationStyle): void => {
    setEditedStyle(next)
    onStyleChange({ uids, styleOptions: next })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${category.CodeMeaning} · ${CodeMeaning}`}
          aria-label={`${CodeMeaning}, ${uids.length} annotations, ${formatVisibilitySummary(visibleCount, uids.length)}`}
          className={cn(
            'flex items-center gap-1.5 rounded-full border border-line py-1 pl-2 pr-2.5 text-[12px] text-ink transition-colors hover:border-line-hover',
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
          <span className="max-w-[140px] truncate">{CodeMeaning}</span>
          <span className="text-ink-muted">{uids.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-80">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[12.5px] font-semibold text-ink">
              {CodeMeaning}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-muted">
              {category.CodeMeaning} · {CodeValue}:{CodingSchemeDesignator}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-ink">
              Visible
              <span className="ml-1.5 font-normal text-ink-muted">
                {visibleCount} / {uids.length}
              </span>
            </span>
            <Switch
              size="sm"
              checked={visibility === 'all'}
              onCheckedChange={() =>
                onVisibilityChange(type, getToggleTarget(visibility))
              }
              aria-label={`Show all ${CodeMeaning}`}
            />
          </div>
          {style !== undefined && (
            <ColorSettingsMenu
              style={style}
              onChange={setEditedStyle}
              onCommit={commitStyle}
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

/** Chips for all annotation types of one category. */
function AnnotationCategoryItem({
  category,
  onChange,
  checkedAnnotationUids,
  onStyleChange,
  defaultAnnotationStyles,
}: AnnotationCategoryItemProps): React.ReactElement {
  const handleVisibilityChange = (type: Type, isVisible: boolean): void => {
    const changes = computeBulkVisibility(
      type.uids,
      checkedAnnotationUids,
      isVisible,
    )
    if (changes.length > 0) onChange(changes)
  }

  return (
    <>
      {category.types.map((type: Type) => (
        <AnnotationTypeChip
          key={`${type.CodingSchemeDesignator}:${type.CodeValue}:${type.CodeMeaning}`}
          category={category}
          type={type}
          checkedAnnotationUids={checkedAnnotationUids}
          onVisibilityChange={handleVisibilityChange}
          onStyleChange={onStyleChange}
          defaultAnnotationStyles={defaultAnnotationStyles}
        />
      ))}
    </>
  )
}

export default AnnotationCategoryItem

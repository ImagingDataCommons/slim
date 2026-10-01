import type React from 'react'
import { useCallback } from 'react'

import { cn } from '../lib/utils'
import {
  type Category,
  getCategoryVisibility,
  type Type,
} from '../utils/annotationCategories'
import { rgbToHex } from '../utils/segmentColors'
import { computeBulkVisibility, getToggleTarget } from '../utils/visibility'
import ColorSettingsMenu from './ColorSettingsMenu'
import type { StyleOptions } from './SlideViewer/types'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Switch } from './ui/switch'

interface AnnotationStyleMap {
  [annotationUID: string]: {
    opacity: number
    color: number[]
    contourOnly: boolean
  }
}

/** One annotation type as a pill chip; clicking opens visibility and color settings. */
function AnnotationTypeChip({
  category,
  type,
  checkedAnnotationUids,
  onVisibilityChange,
  onStyleChange,
  defaultAnnotationStyles,
}: {
  category: Category
  type: Type
  checkedAnnotationUids: Set<string>
  onVisibilityChange: (type: Type, isVisible: boolean) => void
  onStyleChange: (arg: { uid: string; styleOptions: StyleOptions }) => void
  defaultAnnotationStyles: AnnotationStyleMap
}): React.ReactElement {
  const { CodeMeaning, CodingSchemeDesignator, CodeValue, uids } = type
  const visibleCount = uids.filter((uid) =>
    checkedAnnotationUids.has(uid),
  ).length
  const visibility = getCategoryVisibility(type, checkedAnnotationUids)
  const isVisible = visibility !== 'none'
  const style = defaultAnnotationStyles[uids[0]]
  const color = style !== undefined ? rgbToHex(style.color) : undefined
  const handleVisibilityChange = useCallback(
    () => onVisibilityChange(type, getToggleTarget(visibility)),
    [type, visibility, onVisibilityChange],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${category.CodeMeaning} · ${CodeMeaning}`}
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
              onCheckedChange={handleVisibilityChange}
              aria-label={
                visibility === 'all'
                  ? `Hide all ${CodeMeaning}`
                  : `Show all ${CodeMeaning}`
              }
            />
          </div>
          <ColorSettingsMenu
            annotationGroupsUIDs={uids}
            onStyleChange={onStyleChange}
            defaultStyle={style}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Chips for all annotation types of one category. */
const AnnotationCategoryItem = ({
  category,
  onChange,
  checkedAnnotationUids,
  onStyleChange,
  defaultAnnotationStyles,
}: {
  category: Category
  onChange: (arg: { roiUID: string; isVisible: boolean }) => void
  onStyleChange: (arg: { uid: string; styleOptions: StyleOptions }) => void
  defaultAnnotationStyles: AnnotationStyleMap
  checkedAnnotationUids: Set<string>
}): React.ReactElement => {
  const handleVisibilityChange = useCallback(
    (type: Type, isVisible: boolean): void => {
      const changes = computeBulkVisibility(
        type.uids,
        checkedAnnotationUids,
        isVisible,
      )
      for (const change of changes) {
        onChange({ roiUID: change.uid, isVisible: change.isVisible })
      }
    },
    [checkedAnnotationUids, onChange],
  )

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

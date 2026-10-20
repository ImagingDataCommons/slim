import type React from 'react'
import { useState } from 'react'

import type { AnnotationStyle } from '../types/layerStyles'
import {
  type Category,
  collectCategoryUids,
  getConceptKey,
  type Type,
} from '../utils/annotationCategories'
import {
  computeBulkVisibility,
  type VisibilityChange,
} from '../utils/visibility'
import { AnnotationChip } from './AnnotationChip'

/** Not every annotation UID has a style entry */
export type AnnotationStyleMap = Record<string, AnnotationStyle | undefined>

export type AnnotationStyleChangeHandler = (change: {
  uids: string[]
  styleOptions: AnnotationStyle
}) => void

export type AnnotationVisibilityChangeHandler = (
  changes: VisibilityChange[],
) => void

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
  /**
   * Drawn ROIs without a distinct Finding category fall back to category=type
   * in the adapter. Skip the category chip so "Tissue" is not shown twice.
   */
  const soleType = category.types.length === 1 ? category.types[0] : undefined
  const showCategoryChip =
    soleType === undefined ||
    getConceptKey(category) !== getConceptKey(soleType)

  return (
    <fieldset
      aria-label={category.CodeMeaning}
      className="flex flex-wrap items-center gap-1.5"
    >
      {showCategoryChip ? (
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
      ) : null}
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

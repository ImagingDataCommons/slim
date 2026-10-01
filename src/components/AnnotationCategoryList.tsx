import type React from 'react'

import {
  type AnnotationCategoryAndType,
  getCategories,
} from '../utils/annotationCategories'
import AnnotationCategoryItem, {
  type AnnotationStyleChangeHandler,
  type AnnotationStyleMap,
} from './AnnotationCategoryItem'

export type {
  AnnotationCategoryAndType,
  Category,
  Type,
} from '../utils/annotationCategories'

export interface AnnotationCategoryListProps {
  annotations: AnnotationCategoryAndType[]
  onChange: (change: { roiUID: string; isVisible: boolean }) => void
  onStyleChange: AnnotationStyleChangeHandler
  defaultAnnotationStyles: AnnotationStyleMap
  checkedAnnotationUids: Set<string>
}

/** Annotation types grouped by category, rendered as chips. */
function AnnotationCategoryList({
  annotations,
  onChange,
  onStyleChange,
  defaultAnnotationStyles,
  checkedAnnotationUids,
}: AnnotationCategoryListProps): React.ReactElement | null {
  const categories = Object.entries(getCategories(annotations))

  if (categories.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map(([categoryKey, category]) => (
        <AnnotationCategoryItem
          key={categoryKey}
          category={category}
          onChange={onChange}
          onStyleChange={onStyleChange}
          defaultAnnotationStyles={defaultAnnotationStyles}
          checkedAnnotationUids={checkedAnnotationUids}
        />
      ))}
    </div>
  )
}

export default AnnotationCategoryList

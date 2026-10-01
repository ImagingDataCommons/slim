import {
  type AnnotationCategoryAndType,
  type Category,
  getCategories,
} from '../utils/annotationCategories'
import AnnotationCategoryItem from './AnnotationCategoryItem'
import type { StyleOptions } from './SlideViewer/types'

export type {
  AnnotationCategoryAndType,
  Category,
  Type,
} from '../utils/annotationCategories'

const AnnotationCategoryList = ({
  annotations,
  onChange,
  onStyleChange,
  defaultAnnotationStyles,
  checkedAnnotationUids,
}: {
  annotations: AnnotationCategoryAndType[]
  onChange: (arg: { roiUID: string; isVisible: boolean }) => void
  onStyleChange: (arg: { uid: string; styleOptions: StyleOptions }) => void
  defaultAnnotationStyles: {
    [annotationUID: string]: {
      opacity: number
      color: number[]
      contourOnly: boolean
    }
  }
  checkedAnnotationUids: Set<string>
}): JSX.Element | null => {
  const categories: Record<string, Category> = getCategories(annotations)

  if (Object.keys(categories).length === 0) {
    return null
  }

  const items = Object.keys(categories).map((categoryKey: string) => {
    const category = categories[categoryKey]
    return (
      <AnnotationCategoryItem
        key={categoryKey}
        category={category}
        onChange={onChange}
        onStyleChange={onStyleChange}
        defaultAnnotationStyles={defaultAnnotationStyles}
        checkedAnnotationUids={checkedAnnotationUids}
      />
    )
  })

  return <div className="flex flex-wrap gap-1.5">{items}</div>
}
export default AnnotationCategoryList

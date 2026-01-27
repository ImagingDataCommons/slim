import { Menu } from 'antd'
import AnnotationCategoryItem from './AnnotationCategoryItem'
import type { StyleOptions } from './SlideViewer/types'

export interface AnnotationCategoryAndType {
  uid: string
  type: Omit<Type, 'uids'>
  category: Omit<Category, 'types'>
}
export interface Type {
  CodeValue: string
  CodeMeaning: string
  CodingSchemeDesignator: string
  uids: string[]
}
export interface Category {
  CodeValue: string
  CodeMeaning: string
  CodingSchemeDesignator: string
  types: Type[]
}

type CategoryWithTypesRecord = Omit<Category, 'types'> & {
  types: Record<string, Type>
}

const getCategories = (
  annotations: AnnotationCategoryAndType[] | undefined,
): Record<string, Category> => {
  const categories: Record<string, CategoryWithTypesRecord> = {}

  for (const annotation of annotations ?? []) {
    const { category, type, uid } = annotation
    const categoryKey = category.CodeMeaning
    const typeKey = type.CodeMeaning

    if (!(categoryKey in categories)) {
      categories[categoryKey] = {
        ...category,
        types: {},
      }
    }
    const cat = categories[categoryKey]
    if (!(typeKey in cat.types)) {
      cat.types[typeKey] = { ...type, uids: [] }
    }
    cat.types[typeKey].uids.push(uid)
  }

  // Normalizing types so that it's an array instead of an object:
  const result: Record<string, Category> = {}
  for (const categoryKey of Object.keys(categories)) {
    const category = categories[categoryKey]
    const typesArr = Object.keys(category.types).map(
      (typeKey: string) => category.types[typeKey],
    )
    result[categoryKey] = { ...category, types: typesArr }
  }

  return result
}

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
        key={
          category.CodeMeaning !== ''
            ? category.CodeMeaning
            : `category-${categoryKey}`
        }
        category={category}
        onChange={onChange}
        onStyleChange={onStyleChange}
        defaultAnnotationStyles={defaultAnnotationStyles}
        checkedAnnotationUids={checkedAnnotationUids}
      />
    )
  })

  return <Menu selectable={false}>{items}</Menu>
}
export default AnnotationCategoryList

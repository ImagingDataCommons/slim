import React from 'react'
import { Menu } from 'antd'
import AnnotationCategoryItem from './AnnotationCategoryItem'

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

const getCategories = (annotations: any): Record<string, Category> => {
  const categories = annotations?.reduce(
    (
      categoriesAcc: Record<string, Category & { types: Record<string, Type> }>,
      annotation: AnnotationCategoryAndType
    ) => {
      const { category, type, uid } = annotation
      const categoryKey = category.CodeMeaning
      const typeKey = type.CodeMeaning

      const oldCategory = categoriesAcc[categoryKey] ?? {
        ...category,
        types: {}
      }
      const oldType = oldCategory.types[typeKey] ?? {
        ...type,
        uids: []
      }

      return {
        ...categoriesAcc,
        [categoryKey]: {
          ...oldCategory,
          types: {
            ...oldCategory.types,
            [typeKey]: { ...oldType, uids: [...oldType.uids, uid] }
          }
        }
      }
    },
    {}
  )

  // Normalizing types so that it's an array instead of an object:
  Object.keys(categories).forEach((categoryKey: string) => {
    const category = categories[categoryKey]
    const { types } = category
    const typesArr = Object.keys(types).map(
      (typeKey: string) => types[typeKey]
    )
    categories[categoryKey].types = typesArr
  })

  return categories
}

const AnnotationCategoryList = ({
  annotations,
  onChange,
  onStyleChange,
  defaultAnnotationStyles,
  checkedAnnotationUids
}: {
  annotations: AnnotationCategoryAndType[]
  onChange: Function
  onStyleChange: Function
  defaultAnnotationStyles: {
    [annotationUID: string]: {
      opacity: number
      color: number[]
      contourOnly: boolean
    }
  }
  checkedAnnotationUids: Set<string>
}): JSX.Element => {
  const categories: Record<string, Category> = getCategories(annotations)

  if (Object.keys(categories).length === 0) {
    return <></>
  }

  const items = Object.keys(categories).map((categoryKey: any) => {
    const category = categories[categoryKey]
    return (
      <AnnotationCategoryItem
        key={category.CodeMeaning}
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

import { type CodedConceptLike, codedConceptKey } from './dicom/codedConcept'
import { getVisibilityState, type VisibilityState } from './visibility'

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

export interface AnnotationCategoryAndType {
  uid: string
  type: Omit<Type, 'uids'>
  category: Omit<Category, 'types'>
}

type CategoryWithTypesRecord = Omit<Category, 'types'> & {
  types: Record<string, Type>
}

/** `SCHEME:VALUE`, falling back to the meaning for uncoded concepts */
export function getConceptKey(concept: CodedConceptLike): string {
  if (
    (concept.CodeValue ?? '') === '' &&
    (concept.CodingSchemeDesignator ?? '') === ''
  ) {
    return `meaning:${concept.CodeMeaning ?? ''}`
  }
  return codedConceptKey(concept)
}

/** Groups annotations by coded category, then by coded type */
export function getCategories(
  annotations: AnnotationCategoryAndType[] | undefined,
): Record<string, Category> {
  const categories: Record<string, CategoryWithTypesRecord> = {}

  for (const annotation of annotations ?? []) {
    const { category, type, uid } = annotation
    const categoryKey = getConceptKey(category)
    const typeKey = getConceptKey(type)

    if (!(categoryKey in categories)) {
      categories[categoryKey] = { ...category, types: {} }
    }
    const entry = categories[categoryKey]
    if (!(typeKey in entry.types)) {
      entry.types[typeKey] = { ...type, uids: [] }
    }
    entry.types[typeKey].uids.push(uid)
  }

  const result: Record<string, Category> = {}
  for (const categoryKey of Object.keys(categories)) {
    const category = categories[categoryKey]
    result[categoryKey] = {
      ...category,
      types: Object.keys(category.types).map((key) => category.types[key]),
    }
  }
  return result
}

export function collectCategoryUids(category: Category): string[] {
  return category.types.flatMap((type) => type.uids)
}

export function getCategoryVisibility(
  categoryOrType: Category | Type,
  visibleUids: Iterable<string>,
): VisibilityState {
  const uids =
    'types' in categoryOrType
      ? collectCategoryUids(categoryOrType)
      : categoryOrType.uids
  return getVisibilityState(uids, visibleUids)
}

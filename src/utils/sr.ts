/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'

import { type CodedConceptLike, isSameCodedConcept } from './dicom/codedConcept'

type ContentItem = dcmjs.sr.valueTypes.ContentItem

export function hasValueType(item: ContentItem, valueType: string): boolean {
  return item.ValueType === valueType
}

/** Root-level content items whose concept name matches `name`; nested items are not searched. */
export function findContentItemsByName({
  content,
  name,
}: {
  content: ContentItem[]
  name: CodedConceptLike
}): ContentItem[] {
  return content.filter((item) => {
    /** Malformed items without a concept name never match */
    const concept = item.ConceptNameCodeSequence?.[0]
    return concept !== undefined && isSameCodedConcept(concept, name)
  })
}

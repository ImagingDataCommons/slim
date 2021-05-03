import * as dcmjs from 'dcmjs'

/**
 * Check whether a DICOM SR content item has a given name.
 *
 * @param item - Content item
 * @param name - Coded name that should be compared
 * @returns Whether the content item has the given name
 */
const hasName = (
  item: dcmjs.sr.valueTypes.ContentItem,
  name: dcmjs.sr.coding.CodedConcept
): boolean => {
  const concept = item.ConceptNameCodeSequence[0]
  return (
    concept.CodeValue === name.CodeValue &&
    concept.CodingSchemeDesignator === name.CodingSchemeDesignator
  )
}

/**
 * Find content items in a DICOM SR document by their given name.
 *
 * Only finds content items at the root level, but not any nested content items.
 *
 * @param content - Document content, i.e., sequence of content items
 * @param name - Coded name that should be compared
 * @returns Matched content items
 */
export const findContentItemsByName = (
  { content, name }: {
    content: dcmjs.sr.valueTypes.ContentItem[]
    name: dcmjs.sr.coding.CodedConcept
  }
): dcmjs.sr.valueTypes.ContentItem[] => {
  const items: dcmjs.sr.valueTypes.ContentItem[] = []
  content.forEach(i => {
    if (hasName(i, name)) {
      items.push(i)
    }
  })
  return items
}

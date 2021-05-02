import * as dcmjs from 'dcmjs'

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

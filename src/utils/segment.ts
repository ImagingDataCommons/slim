export interface SegmentLike {
  algorithmName?: string
  algorithmType?: string
  propertyType?: { CodeMeaning?: string }
  propertyCategory?: { CodeMeaning?: string }
}

export interface SegmentDescription {
  meta: string
  attributes: Array<{ name: string; value: string }>
}

function clean(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** "Binary" from "BINARY" */
export function formatSegmentationType(segmentationType: string): string {
  const type = clean(segmentationType)
  if (type === '') return ''
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

/** "Name (TYPE)", "Name" or "TYPE"; empty when neither is known */
export function formatAlgorithm(segment: SegmentLike): string {
  const name = clean(segment.algorithmName)
  const type = clean(segment.algorithmType)
  if (name !== '' && type !== '') return `${name} (${type})`
  return name !== '' ? name : type
}

export function describeSegment(
  segment: SegmentLike,
  segmentationType: string,
): SegmentDescription {
  const typeLabel = formatSegmentationType(segmentationType)
  const algorithmName = clean(segment.algorithmName)
  const meta = [typeLabel, algorithmName]
    .filter((part) => part !== '')
    .join(' · ')

  const attributes = [
    { name: 'Property type', value: clean(segment.propertyType?.CodeMeaning) },
    {
      name: 'Property category',
      value: clean(segment.propertyCategory?.CodeMeaning),
    },
    { name: 'Algorithm', value: formatAlgorithm(segment) },
    { name: 'Segmentation type', value: typeLabel },
  ].filter((attribute) => attribute.value !== '')

  return { meta, attributes }
}

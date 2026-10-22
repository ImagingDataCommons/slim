import { codedConceptKey } from './dicom/codedConcept'

export interface CodeLike {
  CodeValue: string
  CodingSchemeDesignator: string
  CodeMeaning: string
}

export interface AnnotationGroupMeasurementLike {
  ConceptNameCodeSequence: CodeLike[]
}

export interface AnnotationGroupItemLike {
  AnnotationGroupUID: string
  GraphicType?: string
  NumberOfAnnotations?: number
  MeasurementsSequence?: AnnotationGroupMeasurementLike[]
}

export interface AnnotationGroupMetadataLike<
  T extends AnnotationGroupItemLike = AnnotationGroupItemLike,
> {
  AnnotationCoordinateType?: string
  AnnotationGroupSequence?: T[]
}

export interface MeasurementOption {
  key: string
  value: string
  schemeDesignator: string
  meaning: string
}

export interface AnnotationGroupDescription {
  meta: string
  attributes: Array<{ name: string; value: string }>
  count: number | undefined
}

/** Stable Select value for a measurement concept */
export function getMeasurementKey(code: CodeLike): string {
  return codedConceptKey(code)
}

export function getAnnotationGroupItem<T extends AnnotationGroupItemLike>(
  metadata: AnnotationGroupMetadataLike<T> | undefined,
  uid: string,
): T | undefined {
  return metadata?.AnnotationGroupSequence?.find(
    (item) => item.AnnotationGroupUID === uid,
  )
}

export function getMeasurementOptions(
  item: AnnotationGroupItemLike | undefined,
): MeasurementOption[] {
  const options: MeasurementOption[] = []
  const seen = new Set<string>()
  for (const measurement of item?.MeasurementsSequence ?? []) {
    const name = measurement.ConceptNameCodeSequence?.[0]
    if (name === undefined) continue
    const key = getMeasurementKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    options.push({
      key,
      value: name.CodeValue,
      schemeDesignator: name.CodingSchemeDesignator,
      meaning: name.CodeMeaning,
    })
  }
  return options
}

export function findMeasurementByKey<T extends AnnotationGroupMeasurementLike>(
  item: { MeasurementsSequence?: T[] } | undefined,
  key: string,
): T | undefined {
  return item?.MeasurementsSequence?.find((measurement) => {
    const name = measurement.ConceptNameCodeSequence?.[0]
    return name !== undefined && getMeasurementKey(name) === key
  })
}

export function describeAnnotationGroup(
  group: {
    propertyType?: { CodeMeaning?: string }
    propertyCategory?: { CodeMeaning?: string }
  },
  item: AnnotationGroupItemLike | undefined,
  annotationCoordinateType?: string,
): AnnotationGroupDescription {
  const propertyType = group.propertyType?.CodeMeaning ?? ''
  const propertyCategory = group.propertyCategory?.CodeMeaning ?? ''
  const graphicType = item?.GraphicType ?? ''
  const coordinateType = annotationCoordinateType ?? ''

  const attributes = [
    { name: 'Property type', value: propertyType },
    { name: 'Property category', value: propertyCategory },
    { name: 'Graphic type', value: graphicType },
    { name: 'Annotation coordinate type', value: coordinateType },
  ].filter((attribute) => attribute.value !== '')

  const meta = [propertyType, graphicType.toLowerCase()]
    .filter((part) => part !== '')
    .join(' · ')

  const count =
    typeof item?.NumberOfAnnotations === 'number'
      ? item.NumberOfAnnotations
      : undefined

  return { meta, attributes, count }
}

const FILLABLE_GRAPHIC_TYPES = new Set(['POLYGON', 'RECTANGLE', 'ELLIPSE'])

export function isFillableGraphicType(
  graphicType: string | undefined,
): boolean {
  return graphicType !== undefined && FILLABLE_GRAPHIC_TYPES.has(graphicType)
}

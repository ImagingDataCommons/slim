interface CodeLike {
  CodeValue: string
  CodeMeaning: string
  CodingSchemeDesignator?: string
}

export interface RoiEvaluationLike {
  ValueType: string
  ConceptNameCodeSequence: CodeLike[]
  ConceptCodeSequence?: CodeLike[]
  TextValue?: string
}

export interface RoiMeasurementLike {
  ConceptNameCodeSequence: CodeLike[]
  MeasuredValueSequence?: Array<{
    NumericValue: number | string
    MeasurementUnitsCodeSequence?: CodeLike[]
  }>
}

export interface RoiLike {
  scoord3d?: { graphicType?: string }
  evaluations?: RoiEvaluationLike[]
  measurements?: RoiMeasurementLike[]
}

export interface RoiAttribute {
  name: string
  value: string
}

export const FINDING_TYPE_CODE = '121071'
export const FINDING_CATEGORY_CODE = '276214006'
export const ALGORITHM_NAME_CODE = '111001'

const UNIT_LABELS: Record<string, string> = {
  mm2: 'mm²',
  um2: 'µm²',
  mm: 'mm',
  um: 'µm',
}

const GRAPHIC_TYPE_LABELS: Record<string, string> = {
  POINT: 'Point',
  MULTIPOINT: 'Points',
  POLYLINE: 'Line',
  POLYGON: 'Polygon',
  ELLIPSE: 'Ellipse',
  ELLIPSOID: 'Ellipsoid',
}

function getNameCode(item: { ConceptNameCodeSequence: CodeLike[] }): string {
  return item.ConceptNameCodeSequence?.[0]?.CodeValue ?? ''
}

function getCodeEvaluationMeaning(
  roi: RoiLike,
  conceptNameCode: string,
): string | undefined {
  const evaluation = (roi.evaluations ?? []).find(
    (item) =>
      item.ValueType === 'CODE' && getNameCode(item) === conceptNameCode,
  )
  return evaluation?.ConceptCodeSequence?.[0]?.CodeMeaning
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatUnit(unitCode: string): string {
  return UNIT_LABELS[unitCode] ?? unitCode
}

/** Rounds to significant digits without scientific notation for typical sizes */
export function formatMeasuredValue(
  value: number | string,
  unitCode: string,
  significantDigits = 3,
): string {
  const numeric = Number(value)
  const text = Number.isFinite(numeric)
    ? String(Number(numeric.toPrecision(significantDigits)))
    : String(value)
  return `${text} ${formatUnit(unitCode)}`.trim()
}

/** Finding type (121071) wins over finding category (276214006). */
export function getRoiFinding(roi: RoiLike): string | undefined {
  return (
    getCodeEvaluationMeaning(roi, FINDING_TYPE_CODE) ??
    getCodeEvaluationMeaning(roi, FINDING_CATEGORY_CODE)
  )
}

/** "Polygon · Tumor" from the ROI geometry and its finding evaluation. */
export function describeRoiType(roi: RoiLike): string {
  const graphicType = roi.scoord3d?.graphicType ?? ''
  const geometry = GRAPHIC_TYPE_LABELS[graphicType] ?? graphicType
  return [geometry, getRoiFinding(roi)]
    .filter((part): part is string => part !== undefined && part !== '')
    .join(' · ')
}

function describeMeasurement(
  measurement: RoiMeasurementLike,
  significantDigits: number,
): string | undefined {
  const name = capitalize(
    measurement.ConceptNameCodeSequence?.[0]?.CodeMeaning ?? '',
  )
  const measuredValue = measurement.MeasuredValueSequence?.[0]
  if (measuredValue === undefined) return name !== '' ? name : undefined
  const unitCode =
    measuredValue.MeasurementUnitsCodeSequence?.[0]?.CodeValue ?? ''
  return `${name} ${formatMeasuredValue(
    measuredValue.NumericValue,
    unitCode,
    significantDigits,
  )}`.trim()
}

/** "Area 2.41 mm²" from the first ROI measurement. */
export function describeRoiMeasurement(
  roi: RoiLike,
  significantDigits = 3,
): string | undefined {
  const measurement = roi.measurements?.[0]
  if (measurement === undefined) return undefined
  return describeMeasurement(measurement, significantDigits)
}

/**
 * Evaluations and measurements not already summarized by `describeRoiType`
 * and `describeRoiMeasurement`.
 */
export function getRoiAttributes(roi: RoiLike): RoiAttribute[] {
  const attributes: RoiAttribute[] = []
  const hasFindingType =
    getCodeEvaluationMeaning(roi, FINDING_TYPE_CODE) !== undefined

  for (const item of roi.evaluations ?? []) {
    const nameCode = getNameCode(item)
    const name = item.ConceptNameCodeSequence?.[0]?.CodeMeaning ?? ''
    if (item.ValueType === 'CODE') {
      const value = item.ConceptCodeSequence?.[0]?.CodeMeaning ?? ''
      if (value === '' || nameCode === FINDING_TYPE_CODE) continue
      if (nameCode === FINDING_CATEGORY_CODE) {
        if (hasFindingType) {
          attributes.push({ name: 'Property category', value })
        }
      } else if (nameCode === ALGORITHM_NAME_CODE) {
        attributes.push({ name: 'Algorithm', value })
      } else {
        attributes.push({ name: capitalize(name), value })
      }
    } else if (item.ValueType === 'TEXT') {
      const value = item.TextValue ?? ''
      if (value === '') continue
      attributes.push({
        name: nameCode === ALGORITHM_NAME_CODE ? 'Algorithm' : capitalize(name),
        value,
      })
    }
  }

  for (const measurement of (roi.measurements ?? []).slice(1)) {
    const name = capitalize(
      measurement.ConceptNameCodeSequence?.[0]?.CodeMeaning ?? '',
    )
    const measuredValue = measurement.MeasuredValueSequence?.[0]
    if (measuredValue === undefined) continue
    attributes.push({
      name,
      value: formatMeasuredValue(
        measuredValue.NumericValue,
        measuredValue.MeasurementUnitsCodeSequence?.[0]?.CodeValue ?? '',
      ),
    })
  }

  return attributes
}

export function formatRoiAttributes(attributes: RoiAttribute[]): string {
  return attributes
    .map((attribute) => `${attribute.name}: ${attribute.value}`)
    .join(' · ')
}

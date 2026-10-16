import {
  formatMeasuredValue,
  type LengthUnit,
} from '../../../utils/roiDescription'

interface CodeLike {
  CodeValue: string
  CodeMeaning: string
  CodingSchemeDesignator?: string
}

interface ContentItemLike {
  ConceptNameCodeSequence: readonly CodeLike[]
}

export interface DescribableEvaluation extends ContentItemLike {
  ValueType: string
  ConceptCodeSequence?: readonly CodeLike[]
  TextValue?: string
}

export interface DescribableMeasurement extends ContentItemLike {
  MeasuredValueSequence: ReadonlyArray<{
    NumericValue: number
    MeasurementUnitsCodeSequence: readonly CodeLike[]
  }>
  ContentSequence?: readonly ContentItemLike[]
}

export interface DescribableRoi {
  scoord3d: { graphicType: string }
  evaluations: readonly DescribableEvaluation[]
  measurements: readonly DescribableMeasurement[]
}

export interface RoiDescriptionItem {
  label: string
  value: string
}

export interface RoiMeasurementGroup {
  /** Referenced optical path, or `DEFAULT_MEASUREMENT_GROUP` */
  identifier: string
  items: RoiDescriptionItem[]
}

export interface RoiDescription {
  attributes: RoiDescriptionItem[]
  scoord: RoiDescriptionItem[]
  evaluations: RoiDescriptionItem[]
  measurementGroups: RoiMeasurementGroup[]
}

export const DEFAULT_MEASUREMENT_GROUP = 'default'

const SOURCE_OF_MEASUREMENT = { CodeValue: '121112', scheme: 'DCM' } as const

function isSourceOfMeasurement(item: ContentItemLike): boolean {
  const name = item.ConceptNameCodeSequence[0]
  return (
    name?.CodeValue === SOURCE_OF_MEASUREMENT.CodeValue &&
    name.CodingSchemeDesignator === SOURCE_OF_MEASUREMENT.scheme
  )
}

/** `ReferencedSOPSequence[0].ReferencedOpticalPathIdentifier`, if present */
function referencedOpticalPathIdentifier(item: object): string | undefined {
  if (!('ReferencedSOPSequence' in item)) return undefined
  const sequence = item.ReferencedSOPSequence
  if (!Array.isArray(sequence)) return undefined
  const first: unknown = sequence[0]
  if (
    typeof first !== 'object' ||
    first === null ||
    !('ReferencedOpticalPathIdentifier' in first)
  ) {
    return undefined
  }
  const identifier = first.ReferencedOpticalPathIdentifier
  return typeof identifier === 'string' && identifier !== ''
    ? identifier
    : undefined
}

function measurementGroupIdentifier(
  measurement: DescribableMeasurement,
): string {
  const source = measurement.ContentSequence?.find(isSourceOfMeasurement)
  if (source === undefined) return DEFAULT_MEASUREMENT_GROUP
  return referencedOpticalPathIdentifier(source) ?? DEFAULT_MEASUREMENT_GROUP
}

function describeEvaluation(
  evaluation: DescribableEvaluation,
): RoiDescriptionItem {
  const label = evaluation.ConceptNameCodeSequence[0]?.CodeMeaning ?? ''
  const value =
    evaluation.ValueType === 'CODE'
      ? (evaluation.ConceptCodeSequence?.[0]?.CodeMeaning ?? '')
      : (evaluation.TextValue ?? '')
  return { label, value }
}

/**
 * Rows of the "Selected ROI" dialog: the ROI number (`roiIndex` is 0-based,
 * -1 when unknown), its graphic type, evaluations, and measurements grouped
 * by the optical path they were made on.
 */
export function buildRoiDescription(
  roi: DescribableRoi,
  roiIndex: number,
  units: LengthUnit,
): RoiDescription {
  const groups = new Map<string, RoiDescriptionItem[]>()
  for (const measurement of roi.measurements) {
    const measuredValue = measurement.MeasuredValueSequence[0]
    if (measuredValue === undefined) continue
    const identifier = measurementGroupIdentifier(measurement)
    const items = groups.get(identifier) ?? []
    items.push({
      label: measurement.ConceptNameCodeSequence[0]?.CodeMeaning ?? '',
      value: formatMeasuredValue(
        measuredValue.NumericValue,
        measuredValue.MeasurementUnitsCodeSequence[0]?.CodeValue ?? '',
        { significantDigits: 4, unit: units },
      ),
    })
    groups.set(identifier, items)
  }
  return {
    attributes: [
      { label: '', value: `ROI ${roiIndex >= 0 ? roiIndex + 1 : 'N/A'}` },
    ],
    scoord: [{ label: 'Graphic type', value: roi.scoord3d.graphicType }],
    evaluations: roi.evaluations.map(describeEvaluation),
    measurementGroups: Array.from(groups, ([identifier, items]) => ({
      identifier,
      items,
    })),
  }
}

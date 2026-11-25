/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import type {
  LookupTableLike,
  MappingStyle,
  SegmentStyle,
} from '../../../types/layerStyles'
import {
  getRealWorldValueRange,
  type ParametricMapDatasetLike,
} from '../../../utils/parametricMap'

export type DerivedLegendKind = 'segment' | 'mapping'

type LegendStyle = Pick<SegmentStyle, 'paletteColorLookupTable'> | MappingStyle

export interface DerivedLegendRow {
  id: string
  kind: DerivedLegendKind
  title: string
  /** Palette used for the color bar (sampled via lutToCssGradient) */
  palette: LookupTableLike
  minLabel: string
  maxLabel: string
  isVisible: boolean
}

function paletteOf(
  style: LegendStyle | undefined,
): LookupTableLike | undefined {
  const lut = style?.paletteColorLookupTable
  const data = lut?.data
  if (data == null || data.length === 0) return undefined
  return lut
}

function segmentTitle(segment: dmv.segment.Segment): string {
  const meaning = segment.propertyType?.CodeMeaning
  if (meaning != null && String(meaning).trim() !== '') return String(meaning)
  return segment.label || 'Segment'
}

function mappingTitle(mapping: dmv.mapping.ParameterMapping): string {
  const label = mapping.label
  if (label != null && String(label).trim() !== '') return String(label)
  return 'Parametric map'
}

function isFractional(
  metadata: dmv.metadata.Segmentation[] | undefined,
): boolean {
  return metadata?.[0]?.SegmentationType === 'FRACTIONAL'
}

/** Stored-value span for fractional SEG (matches DMV legend defaults). */
function segmentBounds(metadata: dmv.metadata.Segmentation[] | undefined): {
  minLabel: string
  maxLabel: string
} {
  const bits = metadata?.[0]?.BitsAllocated
  const max =
    typeof bits === 'number' && Number.isFinite(bits) && bits > 0
      ? 2 ** bits - 1
      : 255
  return { minLabel: '0', maxLabel: String(max) }
}

/** Real-world range when present; otherwise stored-value bits (DMV legend). */
function mappingBounds(metadata: dmv.metadata.ParametricMap[] | undefined): {
  minLabel: string
  maxLabel: string
} {
  const range = getRealWorldValueRange(
    metadata?.[0] as ParametricMapDatasetLike | undefined,
  )
  if (range !== undefined) {
    return {
      minLabel: range.first.toFixed(2),
      maxLabel: range.last.toFixed(2),
    }
  }
  const bits = metadata?.[0]?.BitsAllocated
  const max =
    typeof bits === 'number' && Number.isFinite(bits) && bits > 0
      ? 2 ** bits - 1
      : 255
  return { minLabel: '0', maxLabel: String(max) }
}

/**
 * Rows for Slim's in-viewport SEG/PM legend. Fractional segments and
 * parametric maps with a palette, including currently hidden overlays so the
 * legend can turn them back on (same idea as DMV's built-in legend).
 */
export function buildDerivedLegendRows({
  segments,
  segmentMetadata,
  segmentStyles,
  visibleSegmentUIDs,
  mappings,
  mappingMetadata,
  mappingStyles,
  visibleMappingUIDs,
}: {
  segments: readonly dmv.segment.Segment[]
  segmentMetadata: Readonly<Record<string, dmv.metadata.Segmentation[]>>
  segmentStyles: Readonly<Record<string, LegendStyle>>
  visibleSegmentUIDs: ReadonlySet<string>
  mappings: readonly dmv.mapping.ParameterMapping[]
  mappingMetadata: Readonly<Record<string, dmv.metadata.ParametricMap[]>>
  mappingStyles: Readonly<Record<string, LegendStyle>>
  visibleMappingUIDs: ReadonlySet<string>
}): DerivedLegendRow[] {
  const rows: DerivedLegendRow[] = []

  for (const segment of segments) {
    if (segment.isAbsent) continue
    if ((segment as { isBackground?: boolean }).isBackground === true) continue
    if (!isFractional(segmentMetadata[segment.uid])) continue
    const palette = paletteOf(segmentStyles[segment.uid])
    if (palette === undefined) continue
    const bounds = segmentBounds(segmentMetadata[segment.uid])
    rows.push({
      id: segment.uid,
      kind: 'segment',
      title: segmentTitle(segment),
      palette,
      minLabel: bounds.minLabel,
      maxLabel: bounds.maxLabel,
      isVisible: visibleSegmentUIDs.has(segment.uid),
    })
  }

  for (const mapping of mappings) {
    const palette = paletteOf(mappingStyles[mapping.uid])
    if (palette === undefined) continue
    const bounds = mappingBounds(mappingMetadata[mapping.uid])
    rows.push({
      id: mapping.uid,
      kind: 'mapping',
      title: mappingTitle(mapping),
      palette,
      minLabel: bounds.minLabel,
      maxLabel: bounds.maxLabel,
      isVisible: visibleMappingUIDs.has(mapping.uid),
    })
  }

  return rows
}

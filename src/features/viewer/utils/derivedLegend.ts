/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import type { MappingStyle, SegmentStyle } from '../../../types/layerStyles'

export type DerivedLegendKind = 'segment' | 'mapping'

type LegendStyle = Pick<SegmentStyle, 'paletteColorLookupTable'> | MappingStyle

export interface DerivedLegendRow {
  id: string
  kind: DerivedLegendKind
  title: string
  /** RGB triplets 0–255 for the color bar */
  colors: number[][]
  minLabel: string
  maxLabel: string
  isVisible: boolean
}

function paletteColors(style: LegendStyle | undefined): number[][] | undefined {
  const data = style?.paletteColorLookupTable?.data
  if (data == null || data.length === 0) return undefined
  return data as number[][]
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
  mappingStyles,
  visibleMappingUIDs,
}: {
  segments: readonly dmv.segment.Segment[]
  segmentMetadata: Readonly<Record<string, dmv.metadata.Segmentation[]>>
  segmentStyles: Readonly<Record<string, LegendStyle>>
  visibleSegmentUIDs: ReadonlySet<string>
  mappings: readonly dmv.mapping.ParameterMapping[]
  mappingStyles: Readonly<Record<string, LegendStyle>>
  visibleMappingUIDs: ReadonlySet<string>
}): DerivedLegendRow[] {
  const rows: DerivedLegendRow[] = []

  for (const segment of segments) {
    if (segment.isAbsent) continue
    if ((segment as { isBackground?: boolean }).isBackground === true) continue
    if (!isFractional(segmentMetadata[segment.uid])) continue
    const colors = paletteColors(segmentStyles[segment.uid])
    if (colors === undefined) continue
    rows.push({
      id: segment.uid,
      kind: 'segment',
      title: segmentTitle(segment),
      colors,
      minLabel: '0',
      maxLabel: '255',
      isVisible: visibleSegmentUIDs.has(segment.uid),
    })
  }

  for (const mapping of mappings) {
    const colors = paletteColors(mappingStyles[mapping.uid])
    if (colors === undefined) continue
    rows.push({
      id: mapping.uid,
      kind: 'mapping',
      title: mappingTitle(mapping),
      colors,
      minLabel: '0',
      maxLabel: '255',
      isVisible: visibleMappingUIDs.has(mapping.uid),
    })
  }

  return rows
}

/** CSS linear-gradient stops from palette RGB triplets. */
export function paletteGradient(colors: number[][]): string {
  if (colors.length === 1) {
    const [r, g, b] = colors[0]
    return `rgb(${r}, ${g}, ${b})`
  }
  return `linear-gradient(to right, ${colors
    .map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`)
    .join(', ')})`
}

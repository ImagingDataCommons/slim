import type { SegmentStyle } from '../../../types/layerStyles'
import {
  getSegmentationType,
  getSegmentColor,
  type SegmentColorSource,
} from '../../../utils/segmentColors'

export interface SegmentLike {
  uid: string
  number: number
}

export interface SegmentationMetadataLike {
  SegmentationType?: string | null
  SegmentSequence?: readonly SegmentColorSource[]
}

export interface ViewerSegmentStyle {
  opacity: number
  paletteColorLookupTable?: SegmentStyle['paletteColorLookupTable']
}

/**
 * Recommended display colors of the BINARY segments (`undefined` when the
 * Segment Sequence has none). Other segments are drawn through their own
 * palette and have no entry.
 */
export function recommendedBinarySegmentColors(
  segments: readonly SegmentLike[],
  metadata: Readonly<Record<string, readonly SegmentationMetadataLike[]>>,
): Record<string, number[] | undefined> {
  const colors: Record<string, number[] | undefined> = {}
  for (const segment of segments) {
    const first = metadata[segment.uid]?.[0]
    if (getSegmentationType(first) !== 'BINARY') continue
    colors[segment.uid] =
      getSegmentColor({
        segmentSequence: first?.SegmentSequence,
        segmentNumber: segment.number,
      }) ?? undefined
  }
  return colors
}

/** BINARY segment colors with the user's customizations applied */
export function binarySegmentColors(
  recommended: Readonly<Record<string, number[] | undefined>>,
  customized: Readonly<Record<string, number[]>>,
): Record<string, number[] | undefined> {
  const colors: Record<string, number[] | undefined> = {}
  for (const uid of Object.keys(recommended)) {
    colors[uid] = customized[uid] ?? recommended[uid]
  }
  return colors
}

/**
 * Segment list styles: BINARY segments show their color, the others their
 * palette.
 */
export function segmentPanelStyles(
  segments: readonly SegmentLike[],
  viewerStyles: Readonly<Record<string, ViewerSegmentStyle>>,
  binaryColors: Readonly<Record<string, number[] | undefined>>,
): Record<string, SegmentStyle> {
  const styles: Record<string, SegmentStyle> = {}
  for (const { uid } of segments) {
    const opacity = viewerStyles[uid]?.opacity ?? 1
    styles[uid] = Object.hasOwn(binaryColors, uid)
      ? { opacity, color: binaryColors[uid] }
      : {
          opacity,
          color: undefined,
          paletteColorLookupTable:
            viewerStyles[uid]?.paletteColorLookupTable ?? undefined,
        }
  }
  return styles
}

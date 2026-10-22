import dcmjs from 'dcmjs'

import type { RGB } from '../types/layerStyles'
import { toRGB } from './color'
import { logger } from './logger'

/** Segment Sequence item fields read for the recommended display color. */
export interface SegmentColorSource {
  SegmentNumber?: unknown
  RecommendedDisplayCIELabValue?: unknown
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === 'number')
  )
}

/**
 * Recommended display color (CIELab converted to 8-bit RGB) of segment
 * `segmentNumber`, or null when the Segment Sequence does not provide one.
 */
export function getSegmentColor({
  segmentSequence,
  segmentNumber,
}: {
  segmentSequence: readonly SegmentColorSource[] | undefined
  segmentNumber: number
}): RGB | null {
  const lab = segmentSequence?.find(
    (segment) => segment.SegmentNumber === segmentNumber,
  )?.RecommendedDisplayCIELabValue
  if (!isNumberArray(lab) || lab.length < 3) return null
  try {
    const rgb = dcmjs.data.Colors.dicomlab2RGB(lab)
    return toRGB(rgb.map((channel) => channel * 255)) ?? null
  } catch (error) {
    logger.warn(
      `Failed to convert the color of segment ${segmentNumber}`,
      error,
    )
    return null
  }
}

/** SegmentationType of a segmentation instance; 'BINARY' when absent. */
export function getSegmentationType(
  metadata: { SegmentationType?: string | null } | null | undefined,
): string {
  return metadata?.SegmentationType ?? 'BINARY'
}

export interface PixelRange {
  min: number
  max: number
}

export interface PixelStatistics extends PixelRange {
  numFramesSampled: number
}

/**
 * Min and max of `pixels`, or `undefined` for an empty array. A single pass
 * instead of spreading into `Math.min`/`Math.max`, whose argument count is
 * limited for large frames.
 */
export function computePixelRange(
  pixels: ArrayLike<number>,
): PixelRange | undefined {
  if (pixels.length === 0) return undefined
  let min = pixels[0]
  let max = pixels[0]
  for (let i = 1; i < pixels.length; i++) {
    const value = pixels[i]
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min, max }
}

/**
 * Frames sampled per optical path. More than one, so a first tile that is
 * mostly background does not set a window that clips the tissue
 */
export const FRAMES_SAMPLED_PER_OPTICAL_PATH = 4

/**
 * Fold an optical path's frame into its statistics, for its first
 * {@link FRAMES_SAMPLED_PER_OPTICAL_PATH} loaded frames; later frames of the
 * same path are ignored.
 */
export function recordFrameStatistics(
  statistics: Map<string, PixelStatistics>,
  opticalPathIdentifier: string,
  pixels: ArrayLike<number> | null | undefined,
): void {
  const sampled = statistics.get(opticalPathIdentifier)?.numFramesSampled ?? 0
  if (sampled >= FRAMES_SAMPLED_PER_OPTICAL_PATH || pixels == null) return
  const range = computePixelRange(pixels)
  if (range === undefined) return
  statistics.set(
    opticalPathIdentifier,
    mergePixelStatistics(statistics.get(opticalPathIdentifier), range),
  )
}

/** Fold one sampled frame's range into the running statistics. */
export function mergePixelStatistics(
  previous: PixelStatistics | undefined,
  range: PixelRange,
): PixelStatistics {
  if (previous === undefined) {
    return { min: range.min, max: range.max, numFramesSampled: 1 }
  }
  return {
    min: Math.min(previous.min, range.min),
    max: Math.max(previous.max, range.max),
    numFramesSampled: previous.numFramesSampled + 1,
  }
}

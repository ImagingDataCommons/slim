/** Maximum pixel value for BitsAllocated, used by optical-path windowing. */
export function maxValueForBitsAllocated(
  bitsAllocated: number | undefined,
): number {
  return 2 ** (bitsAllocated ?? 8) - 1
}

/** Room above an upper limit at or past the sampled maximum */
const WINDOW_HEADROOM = 1.25

/** Steps across a window slider whose range is narrower than this */
const FINE_SLIDER_STEPS = 1000

/**
 * Bounds of an optical path's window slider. The bit depth often far exceeds
 * the stored values (IMC channels window 2–33 out of 0–65535), which put both
 * thumbs at zero, so the observed pixel range is used once a frame has been
 * sampled, widened to keep the current window in view. Narrow ranges get a
 * fractional step so dragging does not round the window to whole numbers.
 */
export function windowSliderBounds({
  bitsMax,
  pixelRange,
  limitValues,
}: {
  bitsMax: number
  pixelRange: { min: number; max: number } | undefined
  limitValues: readonly number[] | undefined
}): { min: number; max: number; step: number } {
  if (pixelRange === undefined) return { min: 0, max: bitsMax, step: 1 }
  const min = Math.min(0, pixelRange.min, limitValues?.[0] ?? 0)
  const upper = limitValues?.[1]
  /**
   * The sampled frame may be dimmer than the window; leave room to drag the
   * upper thumb past it instead of pinning it to the end.
   */
  let max =
    upper !== undefined && upper >= pixelRange.max
      ? upper * WINDOW_HEADROOM
      : pixelRange.max
  /** Never past the largest storable value, which the limits are clamped to */
  max = Math.max(Math.min(max, bitsMax), Math.min(pixelRange.max, bitsMax))
  if (max <= min) max = min + 1
  const span = max - min
  return {
    min,
    max,
    step: span >= FINE_SLIDER_STEPS ? 1 : span / FINE_SLIDER_STEPS,
  }
}

/**
 * A window value as the limit fields show it: whole numbers for whole
 * slider steps, otherwise as many decimals as one step needs, so a value
 * dragged to 12.346153… reads 12.35.
 */
export function roundLimitForDisplay(value: number, step: number): number {
  if (!(step > 0) || step >= 1) return Math.round(value)
  const decimals = Math.min(6, Math.ceil(-Math.log10(step)))
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

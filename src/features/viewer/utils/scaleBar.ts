/** Pure helpers for the viewport scale card. */

export interface ScaleBarSpec {
  /** Bar width in screen pixels */
  widthPx: number
  /** Human label, e.g. "500 µm" or "2 mm" */
  label: string
}

const NICE_STEPS = [1, 2, 5]

/**
 * Largest 1/2/5×10ⁿ physical length that fits in `maxWidthPx` at the given
 * micrometers-per-screen-pixel, and its on-screen width.
 */
export function computeScaleBar(
  micronsPerPixel: number,
  maxWidthPx = 96,
): ScaleBarSpec | null {
  if (!Number.isFinite(micronsPerPixel) || micronsPerPixel <= 0) return null
  const maxMicrons = micronsPerPixel * maxWidthPx
  const exponent = Math.floor(Math.log10(maxMicrons))
  let niceMicrons = 10 ** exponent
  for (const step of NICE_STEPS) {
    const candidate = step * 10 ** exponent
    if (candidate <= maxMicrons) niceMicrons = candidate
  }
  return {
    widthPx: Math.round(niceMicrons / micronsPerPixel),
    label: formatLength(niceMicrons),
  }
}

/** 0.5 → "0.5 µm", 500 → "500 µm", 2000 → "2 mm". */
export function formatLength(microns: number): string {
  if (microns >= 1000) {
    return `${trimNumber(microns / 1000)} mm`
  }
  return `${trimNumber(microns)} µm`
}

function trimNumber(value: number): string {
  return String(Number(value.toPrecision(3)))
}

/**
 * Approximate optical magnification for a screen resolution, using the
 * 10 µm/px ≈ 1× convention (0.25 µm/px → 40×).
 */
export function formatMagnification(micronsPerPixel: number): string {
  if (!Number.isFinite(micronsPerPixel) || micronsPerPixel <= 0) return '—'
  const magnification = 10 / micronsPerPixel
  if (magnification >= 10) return `${Math.round(magnification)}×`
  if (magnification >= 1)
    return `${magnification.toFixed(1).replace(/\.0$/, '')}×`
  return `${magnification.toFixed(2)}×`
}

/** 0.5 → "0.50", 12.3 → "12.3", 250 → "250" */
export function formatMicronsPerPixel(micronsPerPixel: number): string {
  if (!Number.isFinite(micronsPerPixel) || micronsPerPixel <= 0) return '—'
  if (micronsPerPixel < 10) return micronsPerPixel.toFixed(2)
  if (micronsPerPixel < 100) return micronsPerPixel.toFixed(1)
  return Math.round(micronsPerPixel).toString()
}

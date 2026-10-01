import type { RGB } from '../types/layerStyles'
import { clamp } from './math'

function toChannel(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return clamp(Math.round(value), 0, 255)
}

/**
 * Normalizes a viewer color array into an 8-bit `RGB` tuple. Returns
 * `fallback` when fewer than three channels are present.
 */
export function toRGB(
  values: readonly number[] | undefined | null,
  fallback: RGB,
): RGB
export function toRGB(
  values: readonly number[] | undefined | null,
): RGB | undefined
export function toRGB(
  values: readonly number[] | undefined | null,
  fallback?: RGB,
): RGB | undefined {
  if (values === undefined || values === null || values.length < 3) {
    return fallback
  }
  return [toChannel(values[0]), toChannel(values[1]), toChannel(values[2])]
}

/** `#rrggbb` for the first three channels, rounded and clamped to 0-255 */
export function rgbToHex(rgb: readonly number[]): string {
  return `#${[rgb[0], rgb[1], rgb[2]]
    .map((value) => toChannel(value).toString(16).padStart(2, '0'))
    .join('')}`
}

/** `RGB` for `#rrggbb` (the `#` is optional); black when malformed */
export function hexToRgb(hex: string): RGB {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (match === null) return [0, 0, 0]
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ]
}

/** Copy of `color` with one channel replaced and clamped to 0-255 */
export function withChannel(color: RGB, index: 0 | 1 | 2, value: number): RGB {
  const next: RGB = [color[0], color[1], color[2]]
  next[index] = toChannel(value)
  return next
}

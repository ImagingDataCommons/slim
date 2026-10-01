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

/** Copy of `color` with one channel replaced and clamped to 0-255 */
export function withChannel(color: RGB, index: 0 | 1 | 2, value: number): RGB {
  const next: RGB = [color[0], color[1], color[2]]
  next[index] = toChannel(value)
  return next
}

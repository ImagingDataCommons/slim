import { rgbToHex } from './segmentColors'

export type LutLike = number[][] | { data: number[][] }

/**
 * CSS `linear-gradient` for a palette color lookup table, sampled down to at
 * most `maxStops` evenly spaced stops. Returns an empty string for empty LUTs.
 */
export function lutToCssGradient(
  lut: LutLike,
  angle = 90,
  maxStops = 16,
): string {
  const data = Array.isArray(lut) ? lut : lut.data
  if (data === undefined || data.length === 0) return ''
  if (data.length === 1) {
    const color = rgbToHex(data[0])
    return `linear-gradient(${angle}deg, ${color}, ${color})`
  }
  const stopCount = Math.max(2, Math.min(maxStops, data.length))
  const stops: string[] = []
  for (let index = 0; index < stopCount; index++) {
    const position = index / (stopCount - 1)
    const entry = data[Math.round(position * (data.length - 1))]
    stops.push(`${rgbToHex(entry)} ${Math.round(position * 100)}%`)
  }
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`
}

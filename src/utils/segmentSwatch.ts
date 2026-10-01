import type { LookupTableLike, RGB } from '../types/layerStyles'
import { rgbToHex } from './color'
import { lutToCssGradient } from './lutGradient'

/**
 * CSS background of a segment swatch: the flat color for BINARY segments,
 * the palette gradient for FRACTIONAL ones. Undefined when a FRACTIONAL
 * segment has no usable palette, so callers can draw a placeholder.
 */
export function getSegmentSwatchBackground({
  isFractional,
  color,
  palette,
}: {
  isFractional: boolean
  color: RGB
  palette?: LookupTableLike
}): string | undefined {
  if (!isFractional) return rgbToHex(color)
  if (palette === undefined) return undefined
  const gradient = lutToCssGradient(palette)
  return gradient !== '' ? gradient : undefined
}

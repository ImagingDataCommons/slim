import { type LutLike, lutToCssGradient } from './lutGradient'
import { rgbToHex } from './segmentColors'

export interface OpticalPathLike {
  identifier: string
  description?: string
  isMonochromatic: boolean
  illuminationWaveLength?: string | number
  illuminationColor?: { CodeMeaning?: string }
}

export interface OpticalPathStyleLike {
  color?: number[]
  paletteColorLookupTable?: LutLike
}

/** Conventional RGB swatch for brightfield (non-monochrome) paths */
const RGB_SWATCH = 'linear-gradient(135deg, #e04a4a, #3fb56b, #3a6cf0)'

/** Display name: description, else "Brightfield" for RGB, else identifier. */
export function getOpticalPathName(opticalPath: {
  identifier: string
  description?: string
  isMonochromatic: boolean
}): string {
  const description = opticalPath.description?.trim() ?? ''
  if (description !== '') return description
  if (!opticalPath.isMonochromatic) return 'Brightfield'
  return opticalPath.identifier
}

/**
 * Secondary line, e.g. "H&E · RGB · ICC profile" or "DAPI · 405 nm · Blue".
 */
export function getOpticalPathMeta(
  opticalPath: OpticalPathLike,
  options: { hasIccProfile?: boolean; stains?: string[] } = {},
): string {
  const parts: string[] = []
  const stains = (options.stains ?? []).filter((stain) => stain !== '')
  if (stains.length > 0) parts.push(stains.join(', '))
  if (!opticalPath.isMonochromatic) {
    parts.push('RGB')
    if (options.hasIccProfile === true) parts.push('ICC profile')
  } else {
    const wavelength = opticalPath.illuminationWaveLength
    if (wavelength !== undefined && String(wavelength).trim() !== '') {
      parts.push(`${wavelength} nm`)
    }
    const color = opticalPath.illuminationColor?.CodeMeaning?.trim() ?? ''
    if (color !== '') parts.push(color)
  }
  return parts.join(' · ')
}

/**
 * CSS background for the optical path swatch: RGB gradient for color images,
 * the palette LUT gradient or pseudo-color for monochrome channels.
 * Undefined when the channel has no color information.
 */
export function getOpticalPathSwatch(
  opticalPath: Pick<OpticalPathLike, 'isMonochromatic'>,
  style: OpticalPathStyleLike,
): string | undefined {
  if (!opticalPath.isMonochromatic) return RGB_SWATCH
  if (style.paletteColorLookupTable !== undefined) {
    const gradient = lutToCssGradient(style.paletteColorLookupTable, 90)
    if (gradient !== '') return gradient
  }
  if (style.color !== undefined && style.color.length >= 3) {
    return rgbToHex(style.color)
  }
  return undefined
}

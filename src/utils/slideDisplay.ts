/** Display helpers for slide cards and the viewer's active slide chip. */

/**
 * Geometry attributes read from VL Whole Slide Microscopy Image metadata.
 * Nested sequences are typed loosely because DMV's metadata types omit them.
 */
export interface SlideImageGeometry {
  TotalPixelMatrixColumns?: number
  TotalPixelMatrixRows?: number
  SharedFunctionalGroupsSequence?: unknown
  ImageOrientationSlide?: unknown
  TotalPixelMatrixOriginSequence?: unknown
}

export interface SlideDisplaySource {
  description?: string
  seriesDescription?: string
  containerIdentifier?: string
  areVolumeImagesMonochrome: boolean
  volumeImages: SlideImageGeometry[]
}

export type IlluminationType = 'Brightfield' | 'Fluorescence'

function firstItem(sequence: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(sequence) || sequence.length === 0) return undefined
  const item: unknown = sequence[0]
  return typeof item === 'object' && item !== null
    ? (item as Record<string, unknown>)
    : undefined
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** (row, column) pixel spacing in mm from the shared functional groups. */
export function readPixelSpacing(
  image: SlideImageGeometry,
): [number, number] | undefined {
  const pixelMeasures = firstItem(
    firstItem(image.SharedFunctionalGroupsSequence)?.PixelMeasuresSequence,
  )
  const spacing = pixelMeasures?.PixelSpacing
  if (!Array.isArray(spacing) || spacing.length < 2) return undefined
  const row = toFiniteNumber(spacing[0])
  const column = toFiniteNumber(spacing[1])
  if (row === undefined || column === undefined || row <= 0 || column <= 0) {
    return undefined
  }
  return [row, column]
}

/** Finest pixel spacing (mm) across all pyramid levels. */
export function minimumPixelSpacing(
  images: SlideImageGeometry[],
): number | undefined {
  let minimum: number | undefined
  for (const image of images) {
    const spacing = readPixelSpacing(image)
    if (spacing === undefined) continue
    const value = Math.min(spacing[0], spacing[1])
    if (minimum === undefined || value < minimum) minimum = value
  }
  return minimum
}

/** Nominal objective magnification for a base-level resolution. */
export function formatNominalMagnification(micronsPerPixel: number): string {
  if (!Number.isFinite(micronsPerPixel) || micronsPerPixel <= 0) return ''
  if (micronsPerPixel <= 0.125) return '80×'
  if (micronsPerPixel <= 0.25) return '40×'
  if (micronsPerPixel <= 0.5) return '20×'
  if (micronsPerPixel <= 1.0) return '10×'
  return '5×'
}

/** Maximum magnification of the slide, from its finest pyramid level. */
export function getMagnification(
  slide: Pick<SlideDisplaySource, 'volumeImages'>,
): string {
  const spacing = minimumPixelSpacing(slide.volumeImages)
  return spacing === undefined ? '' : formatNominalMagnification(spacing * 1000)
}

/** Slide description, falling back to the series description. */
export function getSlideStainInfo(
  slide: Pick<SlideDisplaySource, 'description' | 'seriesDescription'>,
): string {
  const description = slide.description?.trim() ?? ''
  if (description !== '') return description
  return slide.seriesDescription?.trim() ?? ''
}

export function getIlluminationType(
  slide: Pick<SlideDisplaySource, 'areVolumeImagesMonochrome'>,
): IlluminationType {
  return slide.areVolumeImagesMonochrome ? 'Fluorescence' : 'Brightfield'
}

/**
 * Full container identifier (e.g. "S24-01542-A1"); callers truncate it with
 * CSS. Shortening would collide for slides of the same case.
 */
export function getSlideDisplayId(
  slide: Pick<SlideDisplaySource, 'containerIdentifier'>,
  index?: number,
): string {
  const identifier = slide.containerIdentifier?.trim() ?? ''
  if (identifier !== '') return identifier
  return index !== undefined ? `Slide ${index + 1}` : 'Slide'
}

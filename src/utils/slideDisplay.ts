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
  OpticalPathSequence?: unknown
}

export interface SlideDisplaySource {
  description?: string
  seriesDescription?: string
  containerIdentifier?: string
  areVolumeImagesMonochrome: boolean
  volumeImages: SlideImageGeometry[]
}

export type IlluminationType = 'Brightfield' | 'Fluorescence'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

function firstItem(sequence: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(sequence) || sequence.length === 0) return undefined
  return asRecord(sequence[0])
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

/** Highest positive Objective Lens Power (0048,0112) across all optical paths. */
export function readObjectiveLensPower(
  images: SlideImageGeometry[],
): number | undefined {
  let maximum: number | undefined
  for (const image of images) {
    if (!Array.isArray(image.OpticalPathSequence)) continue
    for (const item of image.OpticalPathSequence) {
      const power = toFiniteNumber(asRecord(item)?.ObjectiveLensPower)
      if (power === undefined || power <= 0) continue
      if (maximum === undefined || power > maximum) maximum = power
    }
  }
  return maximum
}

/** Typical scanner resolution of each objective, finest first. */
const NOMINAL_OBJECTIVES: ReadonlyArray<{
  label: string
  micronsPerPixel: number
}> = [
  { label: '80×', micronsPerPixel: 0.125 },
  { label: '40×', micronsPerPixel: 0.25 },
  { label: '20×', micronsPerPixel: 0.5 },
  { label: '10×', micronsPerPixel: 1 },
  { label: '5×', micronsPerPixel: 2 },
]

/**
 * Nominal objective magnification for a base-level resolution. Scanners do not
 * hit the nominal spacing exactly (40× is often 0.2527 µm/px), so each label
 * covers spacings up to the geometric midpoint with the next coarser objective.
 */
export function formatNominalMagnification(micronsPerPixel: number): string {
  if (!Number.isFinite(micronsPerPixel) || micronsPerPixel <= 0) return ''
  for (let index = 0; index < NOMINAL_OBJECTIVES.length - 1; index++) {
    const finer = NOMINAL_OBJECTIVES[index]
    const coarser = NOMINAL_OBJECTIVES[index + 1]
    if (
      micronsPerPixel <=
      Math.sqrt(finer.micronsPerPixel * coarser.micronsPerPixel)
    ) {
      return finer.label
    }
  }
  return NOMINAL_OBJECTIVES[NOMINAL_OBJECTIVES.length - 1].label
}

/**
 * Maximum magnification of the slide: the Objective Lens Power when the
 * metadata provides one, else estimated from the finest pyramid level.
 */
export function getMagnification(
  slide: Pick<SlideDisplaySource, 'volumeImages'>,
): string {
  const lensPower = readObjectiveLensPower(slide.volumeImages)
  if (lensPower !== undefined) return `${Number(lensPower.toFixed(1))}×`
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

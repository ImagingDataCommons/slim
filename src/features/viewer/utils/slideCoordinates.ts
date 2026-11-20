/**
 * Map OpenLayers coordinates of DMV's volume viewer into the slide coordinate
 * system (mm). Mirrors DMV's `buildTransform` and
 * `_geometryCoordinates2scoord3dCoordinates`, which are applied to the base
 * (highest resolution) pyramid level.
 */

import {
  readPixelSpacing,
  type SlideImageGeometry,
} from '../../../utils/slideDisplay'

/** Top two rows of a 3×3 affine; the last row is always [0, 0, 1]. */
export type SlideAffine = [[number, number, number], [number, number, number]]

export interface SlideAffineParams {
  /** X and Y offset of the total pixel matrix in the slide (mm) */
  offset: [number, number]
  /** Image Orientation (Slide): row then column direction cosines */
  orientation: number[]
  /** (row, column) pixel spacing (mm) */
  spacing: [number, number]
}

/**
 * Affine from (column, row) pixel indices to slide (x, y), including DMV's
 * half-pixel correction so pixel centers map to their physical location.
 */
export function buildSlideAffine({
  offset,
  orientation,
  spacing,
}: SlideAffineParams): SlideAffine {
  const a00 = orientation[0] * spacing[1]
  const a01 = orientation[3] * spacing[0]
  const a10 = orientation[1] * spacing[1]
  const a11 = orientation[4] * spacing[0]
  return [
    [a00, a01, offset[0] - 0.5 * (a00 + a01)],
    [a10, a11, offset[1] - 0.5 * (a10 + a11)],
  ]
}

function toNumber(value: unknown): number {
  return typeof value === 'number' || typeof value === 'string'
    ? Number(value)
    : Number.NaN
}

/** Affine for the base level of a pyramid, or `undefined` if incomplete. */
export function slideAffineFromImages(
  images: SlideImageGeometry[],
): SlideAffine | undefined {
  let base: SlideImageGeometry | undefined
  for (const image of images) {
    if (
      base === undefined ||
      (image.TotalPixelMatrixColumns ?? 0) > (base.TotalPixelMatrixColumns ?? 0)
    ) {
      base = image
    }
  }
  if (base === undefined) return undefined
  const spacing = readPixelSpacing(base)
  const origin = Array.isArray(base.TotalPixelMatrixOriginSequence)
    ? (base.TotalPixelMatrixOriginSequence[0] as
        | Record<string, unknown>
        | undefined)
    : undefined
  const orientation = Array.isArray(base.ImageOrientationSlide)
    ? base.ImageOrientationSlide.map(toNumber)
    : []
  const offset: [number, number] = [
    toNumber(origin?.XOffsetInSlideCoordinateSystem),
    toNumber(origin?.YOffsetInSlideCoordinateSystem),
  ]
  if (
    spacing === undefined ||
    orientation.length !== 6 ||
    !orientation.every(Number.isFinite) ||
    !offset.every(Number.isFinite)
  ) {
    return undefined
  }
  return buildSlideAffine({ offset, orientation, spacing })
}

/**
 * OpenLayers map coordinate (x = column, y = -(row + 1)) → slide (x, y) mm.
 */
export function imageToSlideCoordinates(
  mapCoordinate: readonly number[],
  affine: SlideAffine,
): [number, number] {
  const column = mapCoordinate[0]
  const row = -(mapCoordinate[1] + 1)
  return [
    affine[0][0] * column + affine[0][1] * row + affine[0][2],
    affine[1][0] * column + affine[1][1] * row + affine[1][2],
  ]
}

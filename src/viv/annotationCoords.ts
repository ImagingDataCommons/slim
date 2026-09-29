/**
 * Shared bulk-annotation coordinate helpers.
 *
 * Single source of truth for the `(gx, gy)` → Viv deck XY transform, vertex
 * validity, and first-vertex lookup used by the decode paths in
 * `loadBulkAnnotationLayers` and by the center-out sort (sync + worker) in
 * `centerOutAnnotationOrder`, so their semantics cannot drift.
 */

/**
 * Precomputed `(affineInverse ⊗ pixelToSlide)` when inputs are TMPC pixels (2D),
 * or `affineInverse` alone when `(gx, gy)` are already slide coords — same
 * numeric result as calling the DMV affine helpers per vertex, without
 * function / array churn on millions of points.
 */
export type BulkDeckLinearCoeffs = readonly [
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
]

/**
 * OpenLayers pyramid extent uses flipped row axis: Y in [-(rows+1), -1] (see
 * dicom-microscopy-viewer pyramid.js). Viv MultiscaleImageLayer / BitmapLayer
 * use finest-level pixel space with y = 0 at the top row and y increasing down.
 */
export function openLayersMapYToVivWorldY(mapY: number): number {
  return -mapY - 1
}

/**
 * Zero is a legal coordinate (vertices on the x=0 / y=0 axes) — only
 * non-finite values (NaN / ±Infinity) mark a vertex as invalid.
 */
export function isFiniteVertexXY(gx: number, gy: number): boolean {
  return Number.isFinite(gx) && Number.isFinite(gy)
}

/** Map bulk vertex (gx, gy) → Viv deck XY. */
export function bulkVertexToDeckFast(
  gx: number,
  gy: number,
  c: BulkDeckLinearCoeffs,
): [number, number] {
  const pcol = c[0] * gx + c[1] * gy + c[2]
  const prow = c[3] * gx + c[4] * gy + c[5]
  const olMapY = -(prow + 1)
  return [pcol, openLayersMapYToVivWorldY(olMapY)]
}

/** Like {@link bulkVertexToDeckFast} but writes into `target[writeIndex]` (x) and `[writeIndex+1]` (y). */
export function bulkVertexToDeckFastWrite(
  gx: number,
  gy: number,
  c: BulkDeckLinearCoeffs,
  target: Float64Array,
  writeIndex: number,
): void {
  const pcol = c[0] * gx + c[1] * gy + c[2]
  const prow = c[3] * gx + c[4] * gy + c[5]
  const olMapY = -(prow + 1)
  target[writeIndex] = pcol
  target[writeIndex + 1] = openLayersMapYToVivWorldY(olMapY)
}

export function readTripleFromGraphicBuffer(
  graphicData: Int32Array | Float32Array,
  j: number,
  commonZCoordinate: number,
): [number, number, number] {
  const gx = Number(graphicData[j])
  const gy = Number(graphicData[j + 1])
  const gz = Number.isNaN(commonZCoordinate)
    ? Number(graphicData[j + 2])
    : Number(commonZCoordinate)
  return [gx, gy, gz]
}

/**
 * First vertex of one annotation in deck XY, or `null` when the vertex is out
 * of the buffer's bounds or non-finite.
 */
export function readAnnotationFirstVertexDeckXY(options: {
  graphicData: Int32Array | Float32Array
  graphicIndex: Int32Array | null
  annotationIndex: number
  coordinateDimensionality: number
  commonZCoordinate: number
  deckCoeffs: BulkDeckLinearCoeffs
  hasIndex: boolean
}): [number, number] | null {
  const {
    graphicData,
    graphicIndex,
    annotationIndex,
    coordinateDimensionality,
    commonZCoordinate,
    deckCoeffs,
    hasIndex,
  } = options
  const minRemain = coordinateDimensionality >= 3 ? 3 : 2
  const offset = hasIndex
    ? Number(graphicIndex?.[annotationIndex] ?? 0) - 1
    : annotationIndex * coordinateDimensionality
  if (offset < 0 || offset + minRemain - 1 >= graphicData.length) {
    return null
  }
  const [gx, gy] = readTripleFromGraphicBuffer(
    graphicData,
    offset,
    commonZCoordinate,
  )
  if (!isFiniteVertexXY(gx, gy)) {
    return null
  }
  return bulkVertexToDeckFast(gx, gy, deckCoeffs)
}

/**
 * n×2 array of every annotation's first vertex in deck XY; invalid or missing
 * vertices are `NaN`. Cheap (index-driven) — used to feed the center-out sort,
 * including the worker transfer, without copying the full coordinate buffer.
 */
export function computeFirstVertexDeckXYArray(options: {
  numberOfAnnotations: number
  graphicData: Int32Array | Float32Array
  graphicIndex: Int32Array | null
  coordinateDimensionality: number
  commonZCoordinate: number
  deckCoeffs: BulkDeckLinearCoeffs
}): Float64Array {
  const {
    numberOfAnnotations,
    graphicData,
    graphicIndex,
    coordinateDimensionality,
    commonZCoordinate,
    deckCoeffs,
  } = options
  const hasIndex = graphicIndex !== null && graphicIndex !== undefined
  const out = new Float64Array(numberOfAnnotations * 2)
  out.fill(Number.NaN)
  for (let i = 0; i < numberOfAnnotations; i++) {
    const xy = readAnnotationFirstVertexDeckXY({
      graphicData,
      graphicIndex,
      annotationIndex: i,
      coordinateDimensionality,
      commonZCoordinate,
      deckCoeffs,
      hasIndex,
    })
    if (xy !== null) {
      out[2 * i] = xy[0]
      out[2 * i + 1] = xy[1]
    }
  }
  return out
}

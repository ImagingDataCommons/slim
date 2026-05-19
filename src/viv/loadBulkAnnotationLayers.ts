// skipcq: JS-C1003
import type { Layer, Position } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import dmvDefault, * as dmvNamespace from 'dicom-microscopy-viewer'

import type DicomWebManager from '../DicomWebManager'
import { logger } from '../utils/logger'
import type { BulkAnnotationGeometryContext } from './dicomLoader'
import {
  vivBulkAnnDebug,
  vivBulkAnnNow,
  vivBulkAnnPerf,
  vivBulkAnnPhase,
  vivBulkAnnVerboseProgress,
} from './vivBulkAnnDebug'

/** Smaller Deck PathLayer batches reduce GPU attribute spikes and giant single-layer updates. */
const VIV_BULK_PATHS_PER_PATH_LAYER = 65_000

/** OpenLayers-backed paths; Deck normalizes nested positions per row (`_pathType` unset). */
type PathRowNested = { path: Position[]; closed: boolean }
/** Direct-decode paths: flat XY in deck space; use with `_pathType` `'loop'` or `'open'`. */
type PathRowFlat = { pathFlat: Float64Array }

type PathRow = PathRowNested

type FeatureBuilder = (opts: Record<string, unknown>) => unknown

/** API surface of DMV `bulkSimpleAnnotations` namespace (added in 0.48.21 bundle). */
type BulkSimpleAnnotationsApi = {
  getFeaturesFromBulkAnnotations: (opts: Record<string, unknown>) => unknown[]
  getPointFeature: FeatureBuilder
  getPolygonFeature: FeatureBuilder
  getRectangleFeature: FeatureBuilder
  getEllipseFeature: FeatureBuilder
  getCircleFeature: FeatureBuilder
}

function isBulkSimpleAnnotationsApi(x: unknown): x is BulkSimpleAnnotationsApi {
  if (x === null || typeof x !== 'object') {
    return false
  }
  const o = x as BulkSimpleAnnotationsApi
  return (
    typeof o.getPolygonFeature === 'function' &&
    typeof o.getFeaturesFromBulkAnnotations === 'function'
  )
}

/**
 * DMV publishes a UMD `dist/dicomMicroscopyViewer.bundle.min.js`. Webpack’s
 * `import * as ns` often wraps `module.exports` as `ns.default`, while
 * `import dmv from` resolves to the same object as Node’s `module.exports`.
 * Prefer whichever binding actually attaches `bulkSimpleAnnotations` (0.48.21+).
 */
function dmvModule(): typeof dmvNamespace {
  if (isBulkSimpleAnnotationsApi(dmvNamespace.bulkSimpleAnnotations)) {
    return dmvNamespace
  }
  const fromDefault = dmvDefault as typeof dmvNamespace
  if (isBulkSimpleAnnotationsApi(fromDefault.bulkSimpleAnnotations)) {
    return fromDefault
  }
  return dmvNamespace
}

const dmv = dmvModule()

/** DMV bundle exports `utils` at runtime; local `.d.ts` may omit — cast at call sites. */
const dmvAffineUtils = (
  dmv as unknown as {
    utils: {
      buildTransform: (opts: {
        offset: number[]
        orientation: number[]
        spacing: number[]
      }) => number[][]
      mapPixelCoordToSlideCoord: (opts: {
        point: number[]
        affine: number[][]
      }) => number[]
      applyInverseTransform: (opts: {
        coordinate: number[]
        affine: number[][]
      }) => number[]
    }
  }
).utils

/** Match DMV `bulkAnnotations/utils#getAffineBasedOnPyramidLevel` for 2D pixel → slide affine. */
function readPixelSpacingFromPyramidLevel(
  level: unknown,
): [number, number] | null {
  if (level === null || typeof level !== 'object') {
    return null
  }
  const fgSeq = Reflect.get(level, 'SharedFunctionalGroupsSequence') as
    | unknown[]
    | undefined
  const fg0 = Array.isArray(fgSeq) ? fgSeq[0] : undefined
  if (fg0 === null || typeof fg0 !== 'object') {
    return null
  }
  const pmSeq = Reflect.get(fg0, 'PixelMeasuresSequence') as
    | unknown[]
    | undefined
  const pm0 = Array.isArray(pmSeq) ? pmSeq[0] : undefined
  if (pm0 === null || typeof pm0 !== 'object') {
    return null
  }
  const ps = Reflect.get(pm0, 'PixelSpacing')
  if (!Array.isArray(ps) || ps.length < 2) {
    return null
  }
  return [Number(ps[0]), Number(ps[1])]
}

function affineForReferencedPyramidLevel(options: {
  pyramid: BulkAnnotationGeometryContext['pyramid']
  affineFallback: number[][]
  wrapper: VivBulkGroupGeometryJob['annotationGroupWrapper']
}): number[][] {
  const { pyramid, affineFallback, wrapper } = options
  const refUid =
    wrapper.annotationGroup.referencedSOPInstanceUID ??
    wrapper.metadata.ReferencedImageSequence?.[0]?.ReferencedSOPInstanceUID
  if (typeof refUid !== 'string' || refUid.length === 0) {
    return affineFallback
  }
  const levelUnknown = pyramid.find(
    (p) => p.SOPInstanceUID === refUid,
  ) as unknown
  if (
    levelUnknown === null ||
    typeof levelUnknown !== 'object' ||
    Reflect.get(levelUnknown, 'ImageOrientationSlide') == null ||
    Reflect.get(levelUnknown, 'TotalPixelMatrixOriginSequence') == null
  ) {
    return affineFallback
  }
  const spacing = readPixelSpacingFromPyramidLevel(levelUnknown)
  if (spacing == null) {
    return affineFallback
  }
  const originSeq = (
    Reflect.get(levelUnknown, 'TotalPixelMatrixOriginSequence') as
      | unknown[]
      | undefined
  )?.[0] as Record<string, unknown> | undefined
  if (originSeq === undefined) {
    return affineFallback
  }
  const orientation = Reflect.get(
    levelUnknown,
    'ImageOrientationSlide',
  ) as number[]
  try {
    return dmvAffineUtils.buildTransform({
      offset: [
        Number(originSeq.XOffsetInSlideCoordinateSystem),
        Number(originSeq.YOffsetInSlideCoordinateSystem),
      ],
      orientation,
      spacing,
    })
  } catch {
    return affineFallback
  }
}

/** 3×3 multiply (same layout as dicom-microscopy-viewer `utils`). */
function multiplyAffine3x3(a: number[][], b: number[][]): number[][] {
  const r: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
    }
  }
  return r
}

/**
 * Precomputes `(affineInverse ⊗ pixelToSlide)` when inputs are TMPC pixels (2D), or uses
 * `affineInverse` alone when `(gx,gy)` are already slide coords — same numeric result as
 * calling {@link dmvAffineUtils.mapPixelCoordToSlideCoord} + {@link dmvAffineUtils.applyInverseTransform}
 * per vertex, without function / array churn on millions of points.
 */
type BulkDeckLinearCoeffs = readonly [
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
]

function bulkDeckCoeffsForFastPath(options: {
  annotationCoordinateType: string
  affineInverse: number[][]
  pixelToSlideAffine: number[][]
}): BulkDeckLinearCoeffs {
  const inv = options.affineInverse
  if (options.annotationCoordinateType === '2D') {
    const fused = multiplyAffine3x3(inv, options.pixelToSlideAffine)
    return [
      fused[0][0],
      fused[0][1],
      fused[0][2],
      fused[1][0],
      fused[1][1],
      fused[1][2],
    ]
  }
  return [inv[0][0], inv[0][1], inv[0][2], inv[1][0], inv[1][1], inv[1][2]]
}

/** Map bulk vertex (gx, gy) → Viv deck XY; coeffs from {@link bulkDeckCoeffsForFastPath}. */
function bulkVertexToDeckFast(
  gx: number,
  gy: number,
  c: BulkDeckLinearCoeffs,
): Position {
  const pcol = c[0] * gx + c[1] * gy + c[2]
  const prow = c[3] * gx + c[4] * gy + c[5]
  const olMapY = -(prow + 1)
  return [pcol, openLayersMapYToVivWorldY(olMapY)]
}

/** Like {@link bulkVertexToDeckFast} but writes into `target[writeIndex]` (x) and `[writeIndex+1]` (y). */
function bulkVertexToDeckFastWrite(
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

function readTripleFromGraphicBuffer(
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

/** Deck overlays for one bulk simple-annotation group (paths + optional points). */
export type VivBulkAnnotationLayerSlice = {
  groupUID: string
  layers: Layer[]
}

/**
 * Streaming chunk emission callback. Hydrate calls this each time a fresh batch of
 * Deck layers is ready (typically one `PathLayer` per ~65k polygons), so the viewport
 * can show partial results while remaining decode/transfer work is still in flight.
 */
export type VivBulkChunkEmitter = (
  chunkLayers: Layer[],
  meta: {
    chunkIndex: number
    /** Best-effort estimate (final chunk may be partial); use for progress UI. */
    estimatedTotalChunks: number
  },
) => void | Promise<void>

/**
 * Hand control back to the browser so React can commit, Deck can paint, and user
 * input can be processed before the next decode chunk starts. `setTimeout(0)` is
 * cross-browser; the ~4 ms minimum delay is the right granularity here (one paint
 * roughly every chunk while still amortising decode cost across few tasks).
 */
async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

export type VivBulkAnnotationCatalogPayload = {
  annotationGroups: dmvNamespace.annotation.AnnotationGroup[]
  metadataByGroupUID: Record<
    string,
    dmvNamespace.metadata.MicroscopyBulkSimpleAnnotations
  >
  defaultStylesByGroupUID: Record<string, { opacity: number; color: number[] }>
}

/** Deferred work: fetch bulk pixel data + build deck layers when a group is toggled visible (OpenLayers parity). */
export type VivBulkGroupGeometryJob = {
  annotationGroupUID: string
  color: [number, number, number]
  graphicType: string
  numberOfAnnotations: number
  annotationGroupWrapper: {
    annotationGroup: dmvNamespace.annotation.AnnotationGroup
    style: { opacity: number; color: [number, number, number] }
    defaultStyle: { opacity: number; color: [number, number, number] }
    metadata: dmvNamespace.metadata.MicroscopyBulkSimpleAnnotations
  }
  metadataItem: object
  bulkdataItem: object | undefined
  annotationGroupIndex: number
  ann: dmvNamespace.metadata.MicroscopyBulkSimpleAnnotations
  coordinateDimensionality: number
  commonZCoordinate: number
}

export type VivBulkAnnotationMetadataResult =
  VivBulkAnnotationCatalogPayload & {
    groupGeometryJobs: Record<string, VivBulkGroupGeometryJob>
  }

function emptyMetadataResult(): VivBulkAnnotationMetadataResult {
  return {
    annotationGroups: [],
    metadataByGroupUID: {},
    defaultStylesByGroupUID: {},
    groupGeometryJobs: {},
  }
}

/**
 * After metadata catalog is shown, fetch bulkdata + build deck layers for one group.
 *
 * When `onChunk` is provided, hydrate streams Deck layers progressively (one
 * `PathLayer` per ~65k polygons / one `ScatterplotLayer` for points / one batch for
 * the OL slow path), yielding to the browser between chunks so the user sees partial
 * coverage within ~70–150 ms of fetch completion instead of waiting for the whole
 * decode + first-paint cycle. The final return value still contains every emitted
 * layer for callers that want it.
 */
export async function hydrateVivBulkGroupLayerSlice(options: {
  job: VivBulkGroupGeometryJob
  geometry: BulkAnnotationGeometryContext
  fetchClient: DicomWebManager
  /** Receives Deck layers as soon as each chunk finishes decoding. */
  onChunk?: VivBulkChunkEmitter
  /** Polled between chunks; return `false` to stop emitting (e.g. group toggled off). */
  shouldContinue?: () => boolean
}): Promise<VivBulkAnnotationLayerSlice | null> {
  const tHydrate0 = vivBulkAnnNow()
  const { job, geometry, fetchClient, onChunk, shouldContinue } = options
  const {
    annotationGroupUID,
    color,
    graphicType,
    numberOfAnnotations,
    annotationGroupWrapper,
    metadataItem,
    bulkdataItem,
    annotationGroupIndex,
    ann,
    coordinateDimensionality,
    commonZCoordinate,
  } = job

  const { pyramid, affine, affineInverse, extent } = geometry
  const featureFn = featureFnForGraphicType(graphicType)
  if (featureFn === null) {
    vivBulkAnnDebug('hydrate:unsupported graphicType, skip', {
      annotationGroupUID,
      graphicType,
    })
    return null
  }

  vivBulkAnnDebug('hydrate:enter', {
    annotationGroupUID,
    graphicType,
    numberOfAnnotations,
    coordinateDimensionality,
  })

  const viewMock = {
    calculateExtent: (): number[] => [...extent],
  }

  let graphicData: Int32Array | Float32Array
  let graphicIndex: Int32Array | null
  const tFetch0 = vivBulkAnnNow()
  vivBulkAnnPhase('hydrate:FETCH start (graphicData+graphicIndex)', {
    annotationGroupUID,
    graphicType,
    annotationGroupIndex,
    numberOfAnnotations,
  })
  try {
    ;[graphicData, graphicIndex] = await Promise.all([
      dmv.annotation.fetchGraphicData({
        metadataItem: metadataItem as object,
        bulkdataItem,
        annotationGroupIndex,
        metadata: ann as unknown as object,
        client: fetchClient,
      }),
      dmv.annotation.fetchGraphicIndex({
        metadataItem: metadataItem as object,
        bulkdataItem,
        annotationGroupIndex,
        metadata: ann as unknown as object,
        client: fetchClient,
      }),
    ])
  } catch (e) {
    vivBulkAnnPerf('hydrate:fetchGraphicData+Index FAILED', tFetch0, {
      annotationGroupUID,
      graphicType,
      err: e instanceof Error ? e.message : String(e),
    })
    vivBulkAnnPhase('hydrate:FETCH failed', {
      annotationGroupUID,
      graphicType,
      err: e instanceof Error ? e.message : String(e),
    })
    logger.warn(
      `fetchGraphicData/Index failed`,
      { annotationGroupUID, graphicType },
      e,
    )
    return null
  }

  const dataBytes =
    graphicData?.buffer != null
      ? graphicData.byteLength
      : (graphicData?.length ?? 0) * 4
  const fetchMs = vivBulkAnnNow() - tFetch0
  vivBulkAnnPerf('hydrate:fetchGraphicData+Index', tFetch0, {
    annotationGroupUID,
    graphicType,
    graphicDataLength: graphicData.length,
    graphicDataBytes: dataBytes,
    graphicIndexLength:
      graphicIndex === null || graphicIndex === undefined
        ? 0
        : graphicIndex.length,
    ...(fetchMs >= 2000 || dataBytes >= 80_000_000
      ? {
          bottleneckHint:
            'Dominated by DICOMweb retrieveBulkData (download + browser finishing XHR/progress on the main thread). Polygon decode is a separate perf line.',
        }
      : {}),
  })
  vivBulkAnnPhase('hydrate:FETCH done — PROCESS about to start', {
    annotationGroupUID,
    graphicType,
    graphicDataLength: graphicData.length,
    graphicDataBytes: dataBytes,
    graphicIndexLength:
      graphicIndex === null || graphicIndex === undefined
        ? 0
        : graphicIndex.length,
    fetchMs: Math.round(fetchMs * 10) / 10,
  })
  vivBulkAnnDebug('hydrate:fetch done sample', {
    annotationGroupUID,
    sample: {
      d0: graphicData[0],
      d1: graphicData[1],
      idx0: graphicIndex?.[0],
    },
  })

  if (
    (graphicType === 'POLYGON' || graphicType === 'POLYLINE') &&
    (graphicIndex === null || graphicIndex === undefined)
  ) {
    logger.warn(
      `[Viv] skip bulk group ${annotationGroupUID}: missing LongPrimitivePointIndexList`,
    )
    return null
  }

  let features: unknown[]
  const tDirect0 = vivBulkAnnNow()
  const annotationCoordinateType = String(
    job.ann.AnnotationCoordinateType ?? '2D',
  )
  vivBulkAnnPhase('hydrate:PROCESS start (direct decode fast path)', {
    annotationGroupUID,
    graphicType,
    numberOfAnnotations,
    coordinateDimensionality,
    annotationCoordinateType,
  })
  const fastResult = await fastDeckLayersFromGraphicData({
    graphicType,
    graphicData,
    graphicIndex,
    coordinateDimensionality,
    numberOfAnnotations,
    commonZCoordinate,
    color,
    idPrefix: `viv-bulk-${annotationGroupUID}`,
    annotationCoordinateType,
    geometry,
    annotationGroupWrapper: annotationGroupWrapper,
    onChunk,
    shouldContinue,
  })
  if (fastResult !== null) {
    const { layers: fastDeckSlices, pathRowCount, pointCount } = fastResult
    vivBulkAnnPerf('hydrate:directDecode+PathLayer', tDirect0, {
      annotationGroupUID,
      graphicType,
      pathRowCount,
      pointCount,
      deckLayers: fastDeckSlices.length,
    })
    vivBulkAnnPhase('hydrate:PROCESS done (direct decode fast path)', {
      annotationGroupUID,
      graphicType,
      pathRowCount,
      pointCount,
      deckLayers: fastDeckSlices.length,
      processMs: Math.round((vivBulkAnnNow() - tDirect0) * 10) / 10,
    })
    vivBulkAnnPerf('hydrate:total', tHydrate0, {
      annotationGroupUID,
      graphicType,
      route: 'direct',
      ok: fastDeckSlices.length > 0,
    })
    logger.log(`group → deck (lazy, direct decode)`, {
      annotationGroupUID,
      graphicType,
      deckLayers: fastDeckSlices.length,
      numberOfAnnotations,
    })
    return fastDeckSlices.length > 0
      ? { groupUID: annotationGroupUID, layers: fastDeckSlices }
      : null
  }

  vivBulkAnnPhase(
    'hydrate:PROCESS start (OL slow path — getFeaturesFromBulkAnnotations)',
    {
      annotationGroupUID,
      graphicType,
      numberOfAnnotations,
    },
  )
  const tOl0 = vivBulkAnnNow()
  try {
    features = resolveBulkSimpleAnnotationsApi().getFeaturesFromBulkAnnotations(
      {
        graphicType,
        graphicData,
        graphicIndex,
        measurements: [],
        commonZCoordinate,
        coordinateDimensionality,
        numberOfAnnotations,
        annotationGroupUID,
        annotationGroup: annotationGroupWrapper,
        pyramid,
        affine,
        affineInverse,
        view: viewMock,
        featureFunction: featureFn,
        isHighResolution: () => false,
      },
    )
  } catch (e) {
    vivBulkAnnPhase('hydrate:PROCESS failed (OL slow path)', {
      annotationGroupUID,
      graphicType,
      err: e instanceof Error ? e.message : String(e),
    })
    logger.warn(
      `getFeaturesFromBulkAnnotations failed`,
      { annotationGroupUID, graphicType },
      e,
    )
    return null
  }

  vivBulkAnnPerf('hydrate:getFeaturesFromBulkAnnotations', tOl0, {
    annotationGroupUID,
    graphicType,
    olFeatures: features.length,
  })
  vivBulkAnnPhase('hydrate:PROCESS done (OL slow path) — DECK BUILD start', {
    annotationGroupUID,
    graphicType,
    olFeatures: features.length,
    processMs: Math.round((vivBulkAnnNow() - tOl0) * 10) / 10,
  })

  const tDeck0 = vivBulkAnnNow()
  const deckSlices = featuresToDeckLayers(
    features,
    color,
    `viv-bulk-${annotationGroupUID}`,
    {
      groupUID: annotationGroupUID,
    },
  )
  vivBulkAnnPerf('hydrate:featuresToDeckLayers', tDeck0, {
    annotationGroupUID,
    deckLayers: deckSlices.length,
  })
  vivBulkAnnPhase('hydrate:DECK BUILD done (OL slow path)', {
    annotationGroupUID,
    graphicType,
    deckLayers: deckSlices.length,
    deckBuildMs: Math.round((vivBulkAnnNow() - tDeck0) * 10) / 10,
  })
  vivBulkAnnPerf('hydrate:total', tHydrate0, {
    annotationGroupUID,
    graphicType,
    route: 'ol+dvm',
    ok: deckSlices.length > 0,
  })
  logger.log(`group → deck (lazy)`, {
    annotationGroupUID,
    graphicType,
    olFeatures: features.length,
    deckLayers: deckSlices.length,
  })
  if (deckSlices.length === 0) {
    return null
  }
  // OL slow path doesn't have a natural chunk granularity (features are already
  // fully built), so emit the whole batch as a single chunk to keep the viewport
  // accumulation logic uniform with the fast path.
  if (onChunk !== undefined) {
    vivBulkAnnPhase('hydrate:slow path chunk emit', {
      annotationGroupUID,
      graphicType,
      chunkIndex: 0,
      estimatedTotalChunks: 1,
      final: true,
      deckLayers: deckSlices.length,
    })
    await onChunk(deckSlices, { chunkIndex: 0, estimatedTotalChunks: 1 })
  }
  return { groupUID: annotationGroupUID, layers: deckSlices }
}

type FastDecodeResult = {
  layers: Layer[]
  pathRowCount: number
  pointCount: number
}

async function fastDeckLayersFromGraphicData(options: {
  graphicType: string
  graphicData: Int32Array | Float32Array
  graphicIndex: Int32Array | null
  coordinateDimensionality: number
  numberOfAnnotations: number
  commonZCoordinate: number
  color: [number, number, number]
  idPrefix: string
  annotationCoordinateType: string
  geometry: BulkAnnotationGeometryContext
  annotationGroupWrapper: VivBulkGroupGeometryJob['annotationGroupWrapper']
  onChunk?: VivBulkChunkEmitter
  shouldContinue?: () => boolean
}): Promise<FastDecodeResult | null> {
  const {
    graphicType,
    graphicData,
    graphicIndex,
    coordinateDimensionality,
    numberOfAnnotations,
    commonZCoordinate,
    color,
    idPrefix,
    annotationCoordinateType,
    geometry,
    annotationGroupWrapper,
    onChunk,
    shouldContinue,
  } = options
  const pixelToSlideAffine = affineForReferencedPyramidLevel({
    pyramid: geometry.pyramid,
    affineFallback: geometry.affine,
    wrapper: annotationGroupWrapper,
  })
  const deckCoeffs = bulkDeckCoeffsForFastPath({
    annotationCoordinateType,
    affineInverse: geometry.affineInverse,
    pixelToSlideAffine,
  })
  switch (graphicType) {
    case 'POINT': {
      const { layers, pointCount } = await buildPointLayersFromGraphicData({
        graphicData,
        graphicIndex,
        coordinateDimensionality,
        numberOfAnnotations,
        commonZCoordinate,
        color,
        idPrefix,
        deckCoeffs,
        onChunk,
      })
      return { layers, pathRowCount: 0, pointCount }
    }
    case 'POLYGON':
    case 'POLYLINE': {
      const built = await buildPathLayersFromGraphicData({
        graphicType,
        graphicData,
        graphicIndex,
        coordinateDimensionality,
        numberOfAnnotations,
        commonZCoordinate,
        color,
        idPrefix,
        deckCoeffs,
        onChunk,
        shouldContinue,
      })
      if (built === null) {
        return null
      }
      return {
        layers: built.layers,
        pathRowCount: built.pathRowCount,
        pointCount: 0,
      }
    }
    default:
      return null
  }
}

async function buildPointLayersFromGraphicData(options: {
  graphicData: Int32Array | Float32Array
  graphicIndex: Int32Array | null
  coordinateDimensionality: number
  numberOfAnnotations: number
  commonZCoordinate: number
  color: [number, number, number]
  idPrefix: string
  deckCoeffs: BulkDeckLinearCoeffs
  /** Emitted once for points (single `ScatterplotLayer`). */
  onChunk?: VivBulkChunkEmitter
}): Promise<{ layers: Layer[]; pointCount: number }> {
  const {
    graphicData,
    graphicIndex,
    coordinateDimensionality,
    numberOfAnnotations,
    commonZCoordinate,
    color,
    idPrefix,
    deckCoeffs,
    onChunk,
  } = options
  const tDecode0 = vivBulkAnnNow()
  const points: [number, number][] = []
  const hasIndex =
    Array.isArray(graphicIndex) || graphicIndex instanceof Int32Array
  const verbose = vivBulkAnnVerboseProgress()
  const PROGRESS_EVERY = 100_000
  const minRemain = coordinateDimensionality >= 3 ? 3 : 2
  for (let i = 0; i < numberOfAnnotations; i++) {
    if (
      verbose &&
      numberOfAnnotations > PROGRESS_EVERY &&
      (i === 0 || i % PROGRESS_EVERY === 0 || i === numberOfAnnotations - 1)
    ) {
      vivBulkAnnDebug('directDecode:POINT progress', {
        annotationIndex: i,
        total: numberOfAnnotations,
      })
    }
    const offset = hasIndex
      ? Number(graphicIndex?.[i] ?? 0) - 1
      : i * coordinateDimensionality
    if (offset < 0 || offset + minRemain - 1 >= graphicData.length) {
      continue
    }
    const [gx, gy] = readTripleFromGraphicBuffer(
      graphicData,
      offset,
      commonZCoordinate,
    )
    const p = bulkVertexToDeckFast(gx, gy, deckCoeffs)
    points.push([p[0], p[1]])
  }
  vivBulkAnnPerf('directDecode:POINT decode', tDecode0, {
    idPrefix,
    pointCount: points.length,
    numberOfAnnotations,
  })
  if (points.length === 0) {
    return { layers: [], pointCount: 0 }
  }
  const rgba: [number, number, number, number] = [
    color[0],
    color[1],
    color[2],
    220,
  ]
  const tDeck0 = vivBulkAnnNow()
  vivBulkAnnPhase('directDecode:POINT decode done — DECK BUILD start', {
    idPrefix,
    pointCount: points.length,
    decodeMs: Math.round((vivBulkAnnNow() - tDecode0) * 10) / 10,
  })
  const layers: Layer[] = [
    new ScatterplotLayer<[number, number]>({
      id: `${idPrefix}-pts`,
      data: points,
      getPosition: (d) => d,
      getFillColor: () => rgba,
      getRadius: () => 4,
      radiusUnits: 'pixels',
    }) as unknown as Layer,
  ]
  vivBulkAnnPerf('directDecode:POINT deck build', tDeck0, {
    idPrefix,
    pointCount: points.length,
    deckLayers: layers.length,
  })
  if (onChunk !== undefined) {
    vivBulkAnnPhase('directDecode:POINT chunk emit', {
      idPrefix,
      chunkIndex: 0,
      estimatedTotalChunks: 1,
      final: true,
      pointCount: points.length,
    })
    await onChunk(layers, { chunkIndex: 0, estimatedTotalChunks: 1 })
  }
  return {
    layers,
    pointCount: points.length,
  }
}

async function buildPathLayersFromGraphicData(options: {
  graphicType: 'POLYGON' | 'POLYLINE'
  graphicData: Int32Array | Float32Array
  graphicIndex: Int32Array | null
  coordinateDimensionality: number
  numberOfAnnotations: number
  commonZCoordinate: number
  color: [number, number, number]
  idPrefix: string
  deckCoeffs: BulkDeckLinearCoeffs
  /** Stream each chunk's `PathLayer` as soon as it's ready instead of waiting for full decode. */
  onChunk?: VivBulkChunkEmitter
  /** Polled at every chunk boundary; return `false` to abort the remaining decode. */
  shouldContinue?: () => boolean
}): Promise<{ layers: Layer[]; pathRowCount: number } | null> {
  const {
    graphicType,
    graphicData,
    graphicIndex,
    coordinateDimensionality,
    numberOfAnnotations,
    commonZCoordinate,
    color,
    idPrefix,
    deckCoeffs,
    onChunk,
    shouldContinue,
  } = options
  if (graphicIndex === null) {
    return null
  }
  const tDecode0 = vivBulkAnnNow()
  const verbose = vivBulkAnnVerboseProgress()
  const PROGRESS_EVERY = 50_000
  const rgba: [number, number, number, number] = [
    color[0],
    color[1],
    color[2],
    220,
  ]
  const pathType: 'loop' | 'open' = graphicType === 'POLYGON' ? 'loop' : 'open'
  // PathLayer prop shape kept identical to non-streaming path (positionFormat XY + _pathType so
  // Deck skips normalizePath on millions of vertices).
  const baseProps = {
    positionFormat: 'XY' as const,
    getPath: (d: PathRowFlat) => d.pathFlat,
    getColor: (): typeof rgba => rgba,
    getWidth: (): number => 2,
    widthUnits: 'pixels' as const,
    capRounded: true,
    jointRounded: true,
    _pathType: pathType,
  }
  const estimatedTotalChunks = Math.max(
    1,
    Math.ceil(numberOfAnnotations / VIV_BULK_PATHS_PER_PATH_LAYER),
  )

  const allLayers: Layer[] = []
  let chunkRows: PathRowFlat[] = []
  let chunkIndex = 0
  let totalPathRows = 0
  let cancelled = false
  let tChunkDecode0 = vivBulkAnnNow()

  /** Build the PathLayer for the current chunk, push to `allLayers`, emit + yield. */
  const flushChunk = async (final: boolean): Promise<boolean> => {
    if (chunkRows.length === 0) {
      return true
    }
    const layer = new PathLayer<PathRowFlat>({
      id: `${idPrefix}-paths-${chunkIndex}`,
      data: chunkRows,
      ...baseProps,
    }) as unknown as Layer
    allLayers.push(layer)
    const chunkDecodeMs =
      Math.round((vivBulkAnnNow() - tChunkDecode0) * 10) / 10
    if (onChunk !== undefined) {
      const tEmit0 = vivBulkAnnNow()
      vivBulkAnnPhase(`directDecode:${graphicType} chunk emit`, {
        idPrefix,
        chunkIndex,
        chunkRowCount: chunkRows.length,
        estimatedTotalChunks,
        final,
        chunkDecodeMs,
      })
      await onChunk([layer], { chunkIndex, estimatedTotalChunks })
      // Yield between chunks so React can commit and Deck can paint before
      // the next chunk's decode work occupies the main thread.
      if (!final) {
        await yieldToBrowser()
      }
      vivBulkAnnPerf(`directDecode:${graphicType} chunk emit+yield`, tEmit0, {
        idPrefix,
        chunkIndex,
        chunkRowCount: chunkRows.length,
      })
    }
    chunkRows = []
    chunkIndex++
    tChunkDecode0 = vivBulkAnnNow()
    if (shouldContinue !== undefined && shouldContinue() === false) {
      cancelled = true
      return false
    }
    return true
  }

  for (let i = 0; i < numberOfAnnotations; i++) {
    if (
      verbose &&
      numberOfAnnotations > PROGRESS_EVERY &&
      (i === 0 || i % PROGRESS_EVERY === 0 || i === numberOfAnnotations - 1)
    ) {
      vivBulkAnnDebug(`${graphicType} decode progress`, {
        annotationIndex: i,
        total: numberOfAnnotations,
        pathRowsSoFar: totalPathRows,
        chunkIndex,
      })
    }
    const offset = Number(graphicIndex[i] ?? 0) - 1
    if (offset < 0 || offset >= graphicData.length) {
      continue
    }
    let annotationLength: number
    if (i < numberOfAnnotations - 1) {
      annotationLength = Number(graphicIndex[i + 1] ?? 0) - offset
    } else {
      annotationLength = Math.max(0, graphicData.length - offset)
    }
    const roofExclusive = Math.min(
      offset + annotationLength,
      graphicData.length,
    )

    const maxVerts =
      Math.ceil((roofExclusive - offset) / coordinateDimensionality) + 4
    const buf = new Float64Array(Math.max(maxVerts * 2, 8))
    let w = 0
    for (let j = offset; j < roofExclusive; j++) {
      const readAt =
        graphicType === 'POLYGON' &&
        roofExclusive > offset + coordinateDimensionality &&
        j === roofExclusive - 1
          ? offset
          : j
      if (
        readAt < 0 ||
        readAt + coordinateDimensionality - 1 >= graphicData.length
      ) {
        j += coordinateDimensionality - 1
        continue
      }
      const [gx, gy] = readTripleFromGraphicBuffer(
        graphicData,
        readAt,
        commonZCoordinate,
      )
      if (!gx || !gy) {
        j += coordinateDimensionality - 1
        continue
      }
      bulkVertexToDeckFastWrite(gx, gy, deckCoeffs, buf, w)
      w += 2
      j += coordinateDimensionality - 1
    }
    if (w >= 4) {
      chunkRows.push({ pathFlat: buf.slice(0, w) })
      totalPathRows++
      if (chunkRows.length >= VIV_BULK_PATHS_PER_PATH_LAYER) {
        const carryOn = await flushChunk(false)
        if (!carryOn) {
          break
        }
      }
    }
  }

  if (!cancelled) {
    await flushChunk(true)
  }

  vivBulkAnnPerf(`directDecode:${graphicType} decode+stream`, tDecode0, {
    idPrefix,
    pathRowCount: totalPathRows,
    numberOfAnnotations,
    chunkCount: chunkIndex,
    cancelled,
  })
  if (cancelled) {
    vivBulkAnnPhase(`directDecode:${graphicType} cancelled mid-stream`, {
      idPrefix,
      decodedSoFar: totalPathRows,
      total: numberOfAnnotations,
      chunkCount: chunkIndex,
    })
  }
  if (totalPathRows === 0) {
    vivBulkAnnPhase(
      `directDecode:${graphicType} decode done (no path rows) — DECK BUILD skipped`,
      {
        idPrefix,
        numberOfAnnotations,
      },
    )
    return { layers: [], pathRowCount: 0 }
  }
  return {
    layers: allLayers,
    pathRowCount: totalPathRows,
  }
}

function resolveBulkSimpleAnnotationsApi(): BulkSimpleAnnotationsApi {
  const ns = dmv.bulkSimpleAnnotations
  if (isBulkSimpleAnnotationsApi(ns)) {
    return ns
  }
  const root = dmv as unknown as Record<string, unknown>
  logger.error(`missing bulkSimpleAnnotations on resolved DMV module`, {
    dmvTopKeys: Object.keys(root),
  })
  const msg =
    'dicom-microscopy-viewer: no `bulkSimpleAnnotations` in the loaded bundle. ' +
    'Rebuild the linked package: `cd ../dicom-microscopy-viewer && bun run build`, then restart Slim dev.'
  logger.error(`${msg}`)
  throw new Error(msg)
}

function pickStr(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).length > 0) {
      return String(v)
    }
  }
  return undefined
}

/** First item of a Code Sequence (raw / naturalized metadata shapes vary by server). */
function firstCodedSequenceItem(seq: unknown): Record<string, unknown> | null {
  if (seq == null) {
    return null
  }
  const first = Array.isArray(seq) ? seq[0] : seq
  if (first == null || typeof first !== 'object') {
    return null
  }
  return first as Record<string, unknown>
}

/**
 * Build {@link dcmjs.sr.coding.CodedConcept} when standard tags exist; otherwise
 * pass the sequence item through like `viewer.js` so AnnotationGroup still
 * matches the OpenLayers path (strict parsing had skipped every group for some
 * QIDO / naturalized payloads).
 */
function annotationPropertyCodeFromSequence(
  seq: unknown,
): dcmjs.sr.coding.CodedConcept {
  const raw = firstCodedSequenceItem(seq)
  if (raw == null) {
    return new dcmjs.sr.coding.CodedConcept({
      value: '99SLIM',
      meaning: 'Missing code sequence',
      schemeDesignator: '99SLIM',
    })
  }
  const value = pickStr(raw, 'CodeValue', 'codeValue')
  const meaning = pickStr(raw, 'CodeMeaning', 'codeMeaning')
  const scheme = pickStr(
    raw,
    'CodingSchemeDesignator',
    'codingSchemeDesignator',
  )
  const version = pickStr(raw, 'CodingSchemeVersion', 'codingSchemeVersion')
  if (value !== undefined && meaning !== undefined && scheme !== undefined) {
    try {
      return new dcmjs.sr.coding.CodedConcept({
        value,
        meaning,
        schemeDesignator: scheme,
        schemeVersion: version,
      })
    } catch {
      /* use raw object below */
    }
  }
  return raw as unknown as dcmjs.sr.coding.CodedConcept
}

/**
 * OpenLayers pyramid extent uses flipped row axis: Y in [-(rows+1), -1] (see
 * dicom-microscopy-viewer pyramid.js). Viv MultiscaleImageLayer / BitmapLayer
 * use finest-level pixel space with y = 0 at the top row and y increasing down.
 */
function openLayersMapYToVivWorldY(mapY: number): number {
  return -mapY - 1
}

function buildChunkedVivPathLayers(
  idPrefix: string,
  pathRows: PathRow[],
  rgba: [number, number, number, number],
): Layer[] {
  if (pathRows.length === 0) {
    return []
  }
  if (pathRows.length <= VIV_BULK_PATHS_PER_PATH_LAYER) {
    return [
      new PathLayer<PathRow>({
        id: `${idPrefix}-paths`,
        data: pathRows,
        getPath: (d) => d.path,
        getColor: () => rgba,
        getWidth: () => 2,
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
      }) as unknown as Layer,
    ]
  }
  const out: Layer[] = []
  for (
    let offset = 0, chunk = 0;
    offset < pathRows.length;
    offset += VIV_BULK_PATHS_PER_PATH_LAYER, chunk++
  ) {
    const data = pathRows.slice(offset, offset + VIV_BULK_PATHS_PER_PATH_LAYER)
    out.push(
      new PathLayer<PathRow>({
        id: `${idPrefix}-paths-${chunk}`,
        data,
        getPath: (d) => d.path,
        getColor: () => rgba,
        getWidth: () => 2,
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
      }) as unknown as Layer,
    )
  }
  return out
}

/**
 * Chunked PathLayer for direct-decoded flat paths. Sets `_pathType` so Deck skips
 * normalizePath (avoids re-flattening millions of nested `[x,y]` pairs).
 */
function _buildChunkedVivPathLayersFromFlat(
  idPrefix: string,
  pathRows: PathRowFlat[],
  rgba: [number, number, number, number],
  pathType: 'loop' | 'open',
): Layer[] {
  if (pathRows.length === 0) {
    return []
  }
  // Flat buffers pack [x,y,…]; default PathLayer assumes XYZ strides (wrong length / garbage).
  const baseProps = {
    positionFormat: 'XY' as const,
    getPath: (d: PathRowFlat) => d.pathFlat,
    getColor: (): typeof rgba => rgba,
    getWidth: (): number => 2,
    widthUnits: 'pixels' as const,
    capRounded: true,
    jointRounded: true,
    _pathType: pathType,
  }
  if (pathRows.length <= VIV_BULK_PATHS_PER_PATH_LAYER) {
    return [
      new PathLayer<PathRowFlat>({
        id: `${idPrefix}-paths`,
        data: pathRows,
        ...baseProps,
      }) as unknown as Layer,
    ]
  }
  const out: Layer[] = []
  for (
    let offset = 0, chunk = 0;
    offset < pathRows.length;
    offset += VIV_BULK_PATHS_PER_PATH_LAYER, chunk++
  ) {
    const data = pathRows.slice(offset, offset + VIV_BULK_PATHS_PER_PATH_LAYER)
    out.push(
      new PathLayer<PathRowFlat>({
        id: `${idPrefix}-paths-${chunk}`,
        data,
        ...baseProps,
      }) as unknown as Layer,
    )
  }
  return out
}

function rgbFromLabItem(
  item: { RecommendedDisplayCIELabValue?: number[] },
  fallback: [number, number, number],
): [number, number, number] {
  const lab = item.RecommendedDisplayCIELabValue
  if (Array.isArray(lab) && lab.length >= 3) {
    try {
      const rgb = dcmjs.data.Colors.dicomlab2RGB(lab)
      return [
        Math.max(0, Math.min(255, Math.round(rgb[0] * 255))),
        Math.max(0, Math.min(255, Math.round(rgb[1] * 255))),
        Math.max(0, Math.min(255, Math.round(rgb[2] * 255))),
      ]
    } catch {
      /* use fallback */
    }
  }
  return fallback
}

function appendOlGeometry(
  geom: unknown,
  pathRows: PathRow[],
  points: [number, number][],
): void {
  if (geom === null || typeof geom !== 'object') {
    return
  }
  const g = geom as {
    getType?: () => string
    getCoordinates?: () => unknown
    getCenter?: () => number[]
    getRadius?: () => number
  }
  const t = g.getType?.()
  if (t === 'Point') {
    const c = g.getCoordinates?.() as number[]
    if (c?.length >= 2) {
      points.push([c[0], openLayersMapYToVivWorldY(c[1])])
    }
    return
  }
  if (t === 'LineString') {
    const c = g.getCoordinates?.() as number[][]
    if (c?.length) {
      pathRows.push({
        path: c.map((p): Position => [p[0], openLayersMapYToVivWorldY(p[1])]),
        closed: false,
      })
    }
    return
  }
  if (t === 'Polygon') {
    const rings = g.getCoordinates?.() as number[][][]
    if (rings) {
      for (const ring of rings) {
        pathRows.push({
          path: ring.map(
            (p): Position => [p[0], openLayersMapYToVivWorldY(p[1])],
          ),
          closed: true,
        })
      }
    }
    return
  }
  if (t === 'Circle') {
    const center = g.getCenter?.()
    const r = g.getRadius?.()
    if (
      center != null &&
      center.length >= 2 &&
      typeof r === 'number' &&
      r > 0
    ) {
      const n = 48
      const path: Position[] = []
      const cx = center[0]
      const cy = center[1]
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2
        path.push([
          cx + r * Math.cos(a),
          openLayersMapYToVivWorldY(cy + r * Math.sin(a)),
        ])
      }
      pathRows.push({ path, closed: true })
    }
  }
}

function featuresToDeckLayers(
  features: unknown[],
  color: [number, number, number],
  idPrefix: string,
  /** When set, log if OL features did not translate to any deck layer. */
  logContext?: { groupUID: string },
): Layer[] {
  const pathRows: PathRow[] = []
  const points: [number, number][] = []
  let unknownGeom = 0
  for (const f of features) {
    const feat = f as { getGeometry?: () => unknown }
    const geom = feat.getGeometry?.()
    if (geom == null || typeof geom !== 'object') {
      unknownGeom++
      continue
    }
    const g = geom as { getType?: () => string }
    const t = g.getType?.()
    if (
      t !== 'Point' &&
      t !== 'LineString' &&
      t !== 'Polygon' &&
      t !== 'Circle'
    ) {
      unknownGeom++
    }
    appendOlGeometry(geom, pathRows, points)
  }
  const layers: Layer[] = []
  const rgba: [number, number, number, number] = [
    color[0],
    color[1],
    color[2],
    220,
  ]
  if (pathRows.length > 0) {
    layers.push(...buildChunkedVivPathLayers(idPrefix, pathRows, rgba))
  }
  if (points.length > 0) {
    layers.push(
      new ScatterplotLayer<[number, number]>({
        id: `${idPrefix}-pts`,
        data: points,
        getPosition: (d) => d,
        getFillColor: () => rgba,
        getRadius: () => 4,
        radiusUnits: 'pixels',
      }) as unknown as Layer,
    )
  }
  if (logContext != null && features.length > 0 && layers.length === 0) {
    logger.warn(
      `group ${logContext.groupUID}: ${features.length} OL feature(s) but 0 Deck layers`,
      {
        pathRowCandidates: pathRows.length,
        pointCandidates: points.length,
        skippedNoOrUnsupportedGeom: unknownGeom,
      },
    )
  }
  return layers
}

function featureFnForGraphicType(graphicType: string): FeatureBuilder | null {
  const b = resolveBulkSimpleAnnotationsApi()
  switch (graphicType) {
    case 'POINT':
      return b.getPointFeature as FeatureBuilder
    case 'POLYGON':
    case 'POLYLINE':
      return b.getPolygonFeature as FeatureBuilder
    case 'RECTANGLE':
      return b.getRectangleFeature as FeatureBuilder
    case 'ELLIPSE':
      return b.getEllipseFeature as FeatureBuilder
    case 'CIRCLE':
      return b.getCircleFeature as FeatureBuilder
    default:
      return null
  }
}

/**
 * QIDO ANN series, retrieve metadata for bulk groups that reference
 * `imageSeriesInstanceUID` and build the catalog + lazy geometry jobs (no bulkdata fetch yet).
 * Deck layers are created in {@link hydrateVivBulkGroupLayerSlice} when the user shows a group.
 */
export async function loadBulkAnnotationMetadataAndJobs(options: {
  geometry: BulkAnnotationGeometryContext
  studyInstanceUID: string
  imageSeriesInstanceUID: string
  /** Store used for ANN search + metadata (may differ from SM). */
  annotationClient: DicomWebManager
  /** Present for API parity with the classic path; bulk byte fetch happens lazily per group. */
  fetchClient: DicomWebManager
}): Promise<VivBulkAnnotationMetadataResult> {
  const {
    geometry,
    studyInstanceUID,
    imageSeriesInstanceUID,
    annotationClient,
  } = options

  const { pyramid, extent } = geometry
  const refImage = pyramid[0]
  if (refImage === undefined) {
    logger.warn(`pyramid[0] missing — cannot align annotations`)
    return emptyMetadataResult()
  }

  const refMeta = refImage as {
    SOPInstanceUID?: string
    TotalPixelMatrixColumns?: number
    TotalPixelMatrixRows?: number
  }
  logger.log(`start`, {
    studyInstanceUID,
    imageSeriesInstanceUID,
    refSOPInstanceUID: refMeta.SOPInstanceUID,
    finestColumns: refMeta.TotalPixelMatrixColumns,
    finestRows: refMeta.TotalPixelMatrixRows,
    extent,
  })

  const tMeta0 = vivBulkAnnNow()
  vivBulkAnnPhase('metadata:FETCH start (QIDO searchForSeries Modality=ANN)', {
    studyInstanceUID,
    imageSeriesInstanceUID,
  })

  let matched = await annotationClient.searchForSeries({
    studyInstanceUID,
    queryParams: {
      Modality: 'ANN',
    },
  })

  vivBulkAnnPerf('metadata:searchForSeries Modality=ANN', tMeta0, {
    numSeries: matched?.length ?? 0,
  })
  vivBulkAnnPhase('metadata:searchForSeries done', {
    numSeries: matched?.length ?? 0,
    searchMs: Math.round((vivBulkAnnNow() - tMeta0) * 10) / 10,
  })
  if (matched === null || matched === undefined) {
    matched = []
  }

  const annSeriesSummaries = matched.map((raw) => {
    try {
      const { dataset } = dmv.metadata.formatMetadata(raw)
      const d = dataset as {
        SeriesInstanceUID?: string
        Modality?: string
      }
      return {
        SeriesInstanceUID: d.SeriesInstanceUID,
        Modality: d.Modality,
      }
    } catch {
      return { SeriesInstanceUID: '(formatMetadata failed)', Modality: '?' }
    }
  })
  logger.log(`QIDO Modality=ANN → ${matched.length} series`, {
    series: annSeriesSummaries,
  })

  if (matched.length === 0) {
    logger.warn(
      `no ANN series from this store for study — check store / QIDO / Modality`,
    )
    return emptyMetadataResult()
  }

  const groupGeometryJobs: Record<string, VivBulkGroupGeometryJob> = {}
  const annotationGroupsByUid = new Map<
    string,
    dmvNamespace.annotation.AnnotationGroup
  >()
  const metadataByGroupUID: Record<
    string,
    dmvNamespace.metadata.MicroscopyBulkSimpleAnnotations
  > = {}
  const defaultStylesByGroupUID: Record<
    string,
    { opacity: number; color: number[] }
  > = {}

  const tSeriesAll0 = vivBulkAnnNow()
  vivBulkAnnPhase(
    'metadata:FETCH start (retrieveSeriesMetadata for each ANN series)',
    {
      annSeriesCount: matched.length,
    },
  )
  let seriesMetadataFetched = 0
  let seriesMetadataInstances = 0

  for (const s of matched) {
    const { dataset } = dmv.metadata.formatMetadata(s)
    const series = dataset as { SeriesInstanceUID: string }
    let retrieved: object[]
    const tSeries0 = vivBulkAnnNow()
    vivBulkAnnDebug('metadata: retrieveSeriesMetadata …', {
      annSeriesInstanceUID: series.SeriesInstanceUID,
    })
    try {
      retrieved = await annotationClient.retrieveSeriesMetadata({
        studyInstanceUID,
        seriesInstanceUID: series.SeriesInstanceUID,
      })
      seriesMetadataFetched++
      seriesMetadataInstances += retrieved.length
      vivBulkAnnPerf('metadata:retrieveSeriesMetadata', tSeries0, {
        annSeriesInstanceUID: series.SeriesInstanceUID,
        numInstances: retrieved.length,
      })
    } catch (e) {
      vivBulkAnnPerf('metadata:retrieveSeriesMetadata FAILED', tSeries0, {
        annSeriesInstanceUID: series.SeriesInstanceUID,
        err: e instanceof Error ? e.message : String(e),
      })
      logger.warn(
        `retrieveSeriesMetadata failed`,
        { seriesInstanceUID: series.SeriesInstanceUID },
        e,
      )
      continue
    }

    logger.log(`retrieved`, {
      annSeriesInstanceUID: series.SeriesInstanceUID,
      numInstances: retrieved.length,
    })

    const annotations = retrieved.map(
      (metadata) =>
        new dmv.metadata.MicroscopyBulkSimpleAnnotations({
          metadata: metadata as object,
        }),
    )

    for (const ann of annotations) {
      const refSer = ann.ReferencedSeriesSequence?.[0]
      const refImg = ann.ReferencedImageSequence?.[0]
      if (refSer === undefined || refImg === undefined) {
        logger.log(`skip instance: missing ReferencedSeries/Image`, {
          annSOP: ann.SOPInstanceUID,
        })
        continue
      }
      if (refSer.SeriesInstanceUID !== imageSeriesInstanceUID) {
        logger.log(`skip instance: references other SM series`, {
          annSOP: ann.SOPInstanceUID,
          referencedSeries: refSer.SeriesInstanceUID,
          activeSlideSeries: imageSeriesInstanceUID,
        })
        continue
      }

      logger.log(`instance matches slide`, {
        annSOP: ann.SOPInstanceUID,
        annSeries: ann.SeriesInstanceUID,
        groups: (ann.AnnotationGroupSequence ?? []).length,
      })

      const bulkRoot = ann.bulkdataReferences as {
        AnnotationGroupSequence?: object[] | null
      }

      for (const item of ann.AnnotationGroupSequence ?? []) {
        const annotationGroupUID = item.AnnotationGroupUID as string
        const color = rgbFromLabItem(item, [220, 60, 60])
        const annotationGroupIndex = Number(item.AnnotationGroupNumber) - 1
        const metadataItem =
          ann.AnnotationGroupSequence[annotationGroupIndex] ?? item

        const propertyCategory = annotationPropertyCodeFromSequence(
          item.AnnotationPropertyCategoryCodeSequence,
        )
        const propertyType = annotationPropertyCodeFromSequence(
          item.AnnotationPropertyTypeCodeSequence,
        )

        let bulkdataItem: object | undefined
        if (bulkRoot.AnnotationGroupSequence != null) {
          bulkdataItem = bulkRoot.AnnotationGroupSequence[
            annotationGroupIndex
          ] as object
        }

        const annotationGroupWrapper = {
          annotationGroup: new dmv.annotation.AnnotationGroup({
            uid: annotationGroupUID,
            number: item.AnnotationGroupNumber,
            label: item.AnnotationGroupLabel,
            algorithmType: item.AnnotationGroupGenerationType ?? '',
            algorithmName:
              item.AnnotationGroupAlgorithmIdentificationSequence?.[0]
                ?.AlgorithmName ?? '',
            propertyCategory,
            propertyType,
            studyInstanceUID: ann.StudyInstanceUID,
            seriesInstanceUID: ann.SeriesInstanceUID,
            sopInstanceUIDs: [ann.SOPInstanceUID],
            referencedSeriesInstanceUID: refSer.SeriesInstanceUID,
            referencedSOPInstanceUID: refImg.ReferencedSOPInstanceUID,
          }),
          style: { opacity: 1, color },
          defaultStyle: { opacity: 1, color },
          metadata: ann,
        }

        const numberOfAnnotations = Number(metadataItem.NumberOfAnnotations)
        const graphicType = metadataItem.GraphicType as string
        const featureFn = featureFnForGraphicType(graphicType)
        if (featureFn === null || numberOfAnnotations <= 0) {
          logger.log(`skip group: graphic type / count`, {
            annotationGroupUID,
            graphicType,
            numberOfAnnotations,
            hasFeatureFn: featureFn != null,
          })
          continue
        }

        const coordinateDimensionality =
          dmv.annotation.getCoordinateDimensionality(
            metadataItem,
            ann.AnnotationCoordinateType,
          )
        if (
          coordinateDimensionality === 3 &&
          refImage.FrameOfReferenceUID !== ann.FrameOfReferenceUID
        ) {
          logger.warn(
            `[Viv] skip bulk group ${annotationGroupUID}: frame of reference mismatch`,
          )
          continue
        }

        const commonZCoordinate =
          dmv.annotation.getCommonZCoordinate(metadataItem)

        const colorTriplet: [number, number, number] = [
          color[0],
          color[1],
          color[2],
        ]
        const wrapperForJob = {
          ...annotationGroupWrapper,
          style: {
            opacity: annotationGroupWrapper.style.opacity,
            color: colorTriplet,
          },
          defaultStyle: {
            opacity: annotationGroupWrapper.defaultStyle.opacity,
            color: colorTriplet,
          },
        }

        if (!annotationGroupsByUid.has(annotationGroupUID)) {
          annotationGroupsByUid.set(
            annotationGroupUID,
            annotationGroupWrapper.annotationGroup,
          )
          metadataByGroupUID[annotationGroupUID] = ann
          defaultStylesByGroupUID[annotationGroupUID] = {
            opacity: annotationGroupWrapper.defaultStyle.opacity,
            color: [...colorTriplet],
          }
        }
        if (groupGeometryJobs[annotationGroupUID] === undefined) {
          groupGeometryJobs[annotationGroupUID] = {
            annotationGroupUID,
            color: colorTriplet,
            graphicType,
            numberOfAnnotations,
            annotationGroupWrapper: wrapperForJob,
            metadataItem,
            bulkdataItem,
            annotationGroupIndex,
            ann,
            coordinateDimensionality,
            commonZCoordinate,
          }
          logger.log(`group → catalog (geometry deferred)`, {
            annotationGroupUID,
            graphicType,
          })
        }
      }
    }
  }

  vivBulkAnnPhase(
    'metadata:FETCH done (retrieveSeriesMetadata for all ANN series)',
    {
      annSeriesAttempted: matched.length,
      annSeriesFetched: seriesMetadataFetched,
      totalInstancesFetched: seriesMetadataInstances,
      fetchAllSeriesMs: Math.round((vivBulkAnnNow() - tSeriesAll0) * 10) / 10,
    },
  )
  logger.log(`metadata done: lazy geometry jobs`, {
    groups: Object.keys(groupGeometryJobs).length,
  })
  vivBulkAnnPerf('metadata:catalog complete (all ANN series)', tMeta0, {
    lazyGeometryJobs: Object.keys(groupGeometryJobs).length,
    annotationGroups: annotationGroupsByUid.size,
  })
  vivBulkAnnPhase(
    'metadata:CATALOG done — geometry jobs deferred until group toggled visible',
    {
      lazyGeometryJobs: Object.keys(groupGeometryJobs).length,
      annotationGroups: annotationGroupsByUid.size,
      totalMs: Math.round((vivBulkAnnNow() - tMeta0) * 10) / 10,
    },
  )
  return {
    annotationGroups: [...annotationGroupsByUid.values()],
    metadataByGroupUID,
    defaultStylesByGroupUID,
    groupGeometryJobs,
  }
}

/** @deprecated Prefer {@link loadBulkAnnotationMetadataAndJobs} + lazy hydrate. */
export async function loadBulkAnnotationDeckLayers(
  options: Parameters<typeof loadBulkAnnotationMetadataAndJobs>[0],
): Promise<VivBulkAnnotationMetadataResult> {
  return loadBulkAnnotationMetadataAndJobs(options)
}

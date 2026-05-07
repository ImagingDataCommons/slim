// skipcq: JS-C1003
import type { Layer, Position } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import dmvDefault, * as dmvNamespace from 'dicom-microscopy-viewer'

import type DicomWebManager from '../DicomWebManager'
import type { BulkAnnotationGeometryContext } from './dicomLoader'

/** Console filter: `Viv bulk ANN` */
const VIV_BULK = '[Viv bulk ANN]'

type PathRow = { path: Position[]; closed: boolean }

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

/** Deck overlays for one bulk simple-annotation group (paths + optional points). */
export type VivBulkAnnotationLayerSlice = {
  groupUID: string
  layers: Layer[]
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
 */
export async function hydrateVivBulkGroupLayerSlice(options: {
  job: VivBulkGroupGeometryJob
  geometry: BulkAnnotationGeometryContext
  fetchClient: DicomWebManager
}): Promise<VivBulkAnnotationLayerSlice | null> {
  const { job, geometry, fetchClient } = options
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
    return null
  }

  const viewMock = {
    calculateExtent: (): number[] => [...extent],
  }

  let graphicData: Int32Array | Float32Array
  let graphicIndex: Int32Array | null
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
    console.warn(
      `${VIV_BULK} fetchGraphicData/Index failed`,
      { annotationGroupUID, graphicType },
      e,
    )
    return null
  }

  if (
    (graphicType === 'POLYGON' || graphicType === 'POLYLINE') &&
    (graphicIndex === null || graphicIndex === undefined)
  ) {
    console.warn(
      `[Viv] skip bulk group ${annotationGroupUID}: missing LongPrimitivePointIndexList`,
    )
    return null
  }

  let features: unknown[]
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
    console.warn(
      `${VIV_BULK} getFeaturesFromBulkAnnotations failed`,
      { annotationGroupUID, graphicType },
      e,
    )
    return null
  }

  const deckSlices = featuresToDeckLayers(
    features,
    color,
    `viv-bulk-${annotationGroupUID}`,
    { groupUID: annotationGroupUID },
  )
  console.info(`${VIV_BULK} group → deck (lazy)`, {
    annotationGroupUID,
    graphicType,
    olFeatures: features.length,
    deckLayers: deckSlices.length,
  })
  if (deckSlices.length === 0) {
    return null
  }
  return { groupUID: annotationGroupUID, layers: deckSlices }
}

function resolveBulkSimpleAnnotationsApi(): BulkSimpleAnnotationsApi {
  const ns = dmv.bulkSimpleAnnotations
  if (isBulkSimpleAnnotationsApi(ns)) {
    return ns
  }
  const root = dmv as unknown as Record<string, unknown>
  console.error(
    `${VIV_BULK} missing bulkSimpleAnnotations on resolved DMV module`,
    {
      dmvTopKeys: Object.keys(root),
    },
  )
  const msg =
    'dicom-microscopy-viewer: no `bulkSimpleAnnotations` in the loaded bundle. ' +
    'Rebuild the linked package: `cd ../dicom-microscopy-viewer && bun run build`, then restart Slim dev.'
  console.error(`${VIV_BULK} ${msg}`)
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
    layers.push(
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
    )
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
    console.warn(
      `${VIV_BULK} group ${logContext.groupUID}: ${features.length} OL feature(s) but 0 Deck layers`,
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
    console.warn(`${VIV_BULK} pyramid[0] missing — cannot align annotations`)
    return emptyMetadataResult()
  }

  const refMeta = refImage as {
    SOPInstanceUID?: string
    TotalPixelMatrixColumns?: number
    TotalPixelMatrixRows?: number
  }
  console.info(`${VIV_BULK} start`, {
    studyInstanceUID,
    imageSeriesInstanceUID,
    refSOPInstanceUID: refMeta.SOPInstanceUID,
    finestColumns: refMeta.TotalPixelMatrixColumns,
    finestRows: refMeta.TotalPixelMatrixRows,
    extent,
  })

  let matched = await annotationClient.searchForSeries({
    studyInstanceUID,
    queryParams: {
      Modality: 'ANN',
    },
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
  console.info(`${VIV_BULK} QIDO Modality=ANN → ${matched.length} series`, {
    series: annSeriesSummaries,
  })

  if (matched.length === 0) {
    console.warn(
      `${VIV_BULK} no ANN series from this store for study — check store / QIDO / Modality`,
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

  for (const s of matched) {
    const { dataset } = dmv.metadata.formatMetadata(s)
    const series = dataset as { SeriesInstanceUID: string }
    let retrieved: object[]
    try {
      retrieved = await annotationClient.retrieveSeriesMetadata({
        studyInstanceUID,
        seriesInstanceUID: series.SeriesInstanceUID,
      })
    } catch (e) {
      console.warn(
        `${VIV_BULK} retrieveSeriesMetadata failed`,
        { seriesInstanceUID: series.SeriesInstanceUID },
        e,
      )
      continue
    }

    console.info(`${VIV_BULK} retrieved`, {
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
        console.info(
          `${VIV_BULK} skip instance: missing ReferencedSeries/Image`,
          {
            annSOP: ann.SOPInstanceUID,
          },
        )
        continue
      }
      if (refSer.SeriesInstanceUID !== imageSeriesInstanceUID) {
        console.info(`${VIV_BULK} skip instance: references other SM series`, {
          annSOP: ann.SOPInstanceUID,
          referencedSeries: refSer.SeriesInstanceUID,
          activeSlideSeries: imageSeriesInstanceUID,
        })
        continue
      }

      console.info(`${VIV_BULK} instance matches slide`, {
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
          console.info(`${VIV_BULK} skip group: graphic type / count`, {
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
          console.warn(
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
          console.info(`${VIV_BULK} group → catalog (geometry deferred)`, {
            annotationGroupUID,
            graphicType,
          })
        }
      }
    }
  }

  console.info(`${VIV_BULK} metadata done: lazy geometry jobs`, {
    groups: Object.keys(groupGeometryJobs).length,
  })
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

import type { Layer, PickingInfo } from '@deck.gl/core'
import { OrthographicView } from '@deck.gl/core'
import { type PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import DeckGL, { type DeckGLRef } from '@deck.gl/react'
import { Matrix4 } from '@math.gl/core'
import { MultiscaleImageLayer } from '@vivjs/layers'
import { message, Spin } from 'antd'
import type React from 'react'
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { flushSync } from 'react-dom'

import type { VivSettings } from '../AppConfig'
import HoveredRoiTooltip from '../components/HoveredRoiTooltip'
import VivBulkAnnotationLoadIndicator from '../components/VivBulkAnnotationLoadIndicator'
import type DicomWebManager from '../DicomWebManager'
import {
  getIccProfilesEnabled,
  setIccProfilesEnabled,
  subscribeIccProfilesEnabled,
} from '../preferences/iccProfilesPreference'
import {
  getVivBulkLodEnabled,
  getVivBulkLodLevelsFromFinest,
  resolveVivBulkLodLevelsFromFinest,
  subscribeVivBulkLodPreference,
} from '../preferences/vivBulkLodPreference'
import { logger } from '../utils/logger'
import { terminateCenterOutAnnotationOrderWorker } from './centerOutAnnotationOrder'
import { CenterOutTileset2D } from './centerOutTileset'
import {
  type BulkAnnotationGeometryContext,
  DicomLoader,
  isVivDicomTileNetworkCancellation,
  vivCoarsestLevelSupportsBackgroundRaster,
} from './dicomLoader'
import {
  bulkGroupUidFromDeckLayerId,
  computeVivBulkHighResolution,
  deckLoadCenterFromViewTarget,
  deckViewportBoundsFromViewState,
  detachVivBulkOverlayLayerData,
  hydrateVivBulkGroupLayerSlice,
  loadBulkAnnotationMetadataAndJobs,
  readFinestPyramidPixelSpacingMm,
  rebuildVivBulkLayersForViewport,
  type VivBulkAnnotationCatalogPayload,
  type VivBulkAnnotationLayerSlice,
  type VivBulkGraphicCache,
  type VivBulkGroupGeometryJob,
  vivBulkAnnotationHoverAttributes,
} from './loadBulkAnnotationLayers'
import {
  vivBulkAnnDebug,
  vivBulkAnnNow,
  vivBulkAnnPerf,
  vivBulkAnnPhase,
  vivBulkAnnVerboseProgress,
} from './vivBulkAnnDebug'
import {
  EMPTY_VIV_BULK_LOAD_STATUS,
  removeVivBulkGroupLoadState,
  upsertVivBulkGroupLoadState,
  type VivBulkAnnotationLoadStatus,
  type VivBulkGroupLoadPhase,
  type VivBulkGroupLoadState,
} from './vivBulkLoadStatus'
import {
  buildVivDisplayOptions,
  computeOrthographicFitViewState,
  computeVivBulkCentroidRadiusPixels,
  computeVivBulkPathStrokeWidthPixels,
  orthographicZoomLimits,
  VIV_BULK_DEFAULT_OVERLAY_COLOR,
  VIV_BULK_PATH_STROKE_MAX_PX,
  VIV_BULK_PATH_STROKE_MIN_PX,
} from './vivDisplayDefaults'

export interface VivSlideViewportProps {
  /** SM / tile store client (same as VolumeImageViewer). */
  client: DicomWebManager
  /** ANN series QIDO/metadata; bulk byte fetches still use `client`. Defaults to `client`. */
  bulkAnnotationClient?: DicomWebManager
  /** When true, QIDO/retrieve bulk ANN overlays after the pyramid loads (matches classic viewer). Default true. */
  loadBulkAnnotations?: boolean
  /** Which bulk annotation groups are drawn (classic viewer parity). */
  visibleBulkAnnotationGroupUIDs?: Set<string>
  /** Per-group opacity/color; keys should cover loaded groups (panel initializes from catalog defaults). */
  bulkAnnotationGroupStyles?: Record<
    string,
    { opacity: number; color: number[] }
  >
  /** Fired when bulk ANN metadata is ready for the panel, or when bulk mode clears (geometry loads lazily on toggle). */
  onBulkAnnotationCatalogChange?: (
    catalog: VivBulkAnnotationCatalogPayload | null,
  ) => void
  /** Bulk annotation catalog / per-group fetch+decode progress for UI indicators. */
  onBulkAnnotationLoadStatusChange?: (
    status: VivBulkAnnotationLoadStatus,
  ) => void
  /** For Viv settings: whether ICC profiles exist on the loaded slide (disables ICC switch when false). */
  onIccProfilesAvailabilityChange?: (hasIccProfiles: boolean) => void
  studyInstanceUID: string
  seriesInstanceUID: string
  vivSettings?: VivSettings
}

/** Direct-decode path uses `${id}-paths` or chunked `${id}-paths-0`, … */
function isBulkVivPathLayerId(layerId: string): boolean {
  return /-paths(?:-\d+)?$/.test(layerId)
}

/** Point groups use `${id}-pts` or chunked `${id}-pts-0`, … */
function isBulkVivPointLayerId(layerId: string): boolean {
  return /-pts(?:-\d+)?$/.test(layerId) && !layerId.includes('-centers-pts')
}

/** LOD center markers use `${id}-centers` or chunked `${id}-centers-0`, … */
function isBulkVivCenterLayerId(layerId: string): boolean {
  return (
    /-centers(?:-\d+)?$/.test(layerId) || /-centers-pts(?:-\d+)?$/.test(layerId)
  )
}

function isBulkVivCentroidStreamLayer(layer: Layer): boolean {
  return isBulkVivCenterLayerId(String(layer.id))
}

type BulkScatterRadiusContext = {
  pixelSpacingMm: [number, number] | null
  viewportWidth: number
  viewportHeight: number
  slideWidth: number
  slideHeight: number
}

type StyledScatterLayerCacheEntry = {
  source: Layer
  styleKey: string
  modelMatrix: Matrix4 | null
  deckZoom: number
  highRes: boolean
  styled: Layer
}

type StyledLayerCacheEntry = {
  sourceLayers: Layer[]
  modelMatrix: Matrix4 | null
  styleKey: string
  /** Path stroke depends on zoom; scatter cache entries track zoom separately. */
  deckZoom?: number
  result: Layer[]
  scatterByLayerId?: Map<string, StyledScatterLayerCacheEntry>
}

function bulkStyleKey(
  uid: string,
  st: { opacity: number; color: number[] },
): string {
  return `${uid}:${st.opacity}:${st.color[0]},${st.color[1]},${st.color[2]}`
}

function buildStyledBulkOverlayLayers(
  slicesByUid: Record<string, VivBulkAnnotationLayerSlice>,
  visibleUIDs: Set<string>,
  styles: Record<string, { opacity: number; color: number[] }>,
  defaultStyles: Record<string, { opacity: number; color: number[] }>,
  modelMatrix: Matrix4 | null,
  cache: Map<string, StyledLayerCacheEntry>,
  deckZoom: number,
  readDeckZoom: () => number,
  radiusContext: BulkScatterRadiusContext | null,
  highRes: boolean,
  /** UIDs whose deck layers are supplied separately during bulk byte streaming. */
  excludeGroupUIDs?: ReadonlySet<string>,
): Layer[] {
  const out: Layer[] = []
  for (const uid of visibleUIDs) {
    if (excludeGroupUIDs?.has(uid) === true) {
      continue
    }
    const slice = slicesByUid[uid]
    if (slice == null) {
      continue
    }
    if (slice.streamPreview === true) {
      out.push(...slice.layers)
      continue
    }
    const st = styles[uid] ??
      defaultStyles[uid] ?? {
        opacity: 1,
        color: [...VIV_BULK_DEFAULT_OVERLAY_COLOR],
      }
    const sk = bulkStyleKey(uid, st)
    const hasScatterMarkers = slice.layers.some((layer) => {
      const lid = String(layer.id)
      return isBulkVivPointLayerId(lid) || isBulkVivCenterLayerId(lid)
    })
    const hasPathOverlays = slice.layers.some((layer) =>
      isBulkVivPathLayerId(String(layer.id)),
    )
    const cached = cache.get(uid)
    if (
      !hasScatterMarkers &&
      cached != null &&
      cached.sourceLayers === slice.layers &&
      cached.modelMatrix === modelMatrix &&
      cached.styleKey === sk &&
      (!hasPathOverlays || cached.deckZoom === deckZoom)
    ) {
      out.push(...cached.result)
      continue
    }
    const a = Math.round(Math.max(0, Math.min(1, st.opacity)) * 220)
    const rgba: [number, number, number, number] = [
      st.color[0] ?? 0,
      st.color[1] ?? 0,
      st.color[2] ?? 0,
      a,
    ]
    const matrixProps = modelMatrix != null ? { modelMatrix } : {}
    const uidStyled: Layer[] = []
    const scatterByLayerId =
      hasScatterMarkers && cached?.scatterByLayerId != null
        ? cached.scatterByLayerId
        : new Map<string, StyledScatterLayerCacheEntry>()
    const activeScatterLayerIds = new Set<string>()
    const pathStrokeWidth = (): number =>
      computeVivBulkPathStrokeWidthPixels({
        deckZoom: readDeckZoom(),
        pixelSpacingMm: radiusContext?.pixelSpacingMm ?? null,
      })
    for (const layer of slice.layers) {
      const lid = String(layer.id)
      if (isBulkVivPathLayerId(lid)) {
        uidStyled.push(
          (layer as PathLayer).clone({
            pickable: true,
            getColor: rgba,
            getWidth: pathStrokeWidth,
            widthUnits: 'pixels',
            widthMinPixels: VIV_BULK_PATH_STROKE_MIN_PX,
            widthMaxPixels: VIV_BULK_PATH_STROKE_MAX_PX,
            updateTriggers: {
              getWidth: deckZoom,
              data: (layer as PathLayer).props.updateTriggers?.data,
            },
            ...matrixProps,
          }),
        )
      } else if (isBulkVivPointLayerId(lid) || isBulkVivCenterLayerId(lid)) {
        activeScatterLayerIds.add(lid)
        const scatterCached = scatterByLayerId.get(lid)
        if (
          scatterCached != null &&
          scatterCached.source === layer &&
          scatterCached.styleKey === sk &&
          scatterCached.modelMatrix === modelMatrix &&
          scatterCached.deckZoom === deckZoom &&
          scatterCached.highRes === highRes
        ) {
          uidStyled.push(scatterCached.styled)
          continue
        }
        const lodOverview = isBulkVivCenterLayerId(lid)
        const styled = (layer as ScatterplotLayer).clone({
          pickable: true,
          getFillColor: rgba,
          getRadius: () =>
            computeVivBulkCentroidRadiusPixels({
              deckZoom: readDeckZoom(),
              pixelSpacingMm: radiusContext?.pixelSpacingMm ?? null,
              lodOverview,
              viewportWidth: radiusContext?.viewportWidth,
              viewportHeight: radiusContext?.viewportHeight,
              slideWidth: radiusContext?.slideWidth,
              slideHeight: radiusContext?.slideHeight,
            }),
          radiusMinPixels: 1,
          updateTriggers: {
            getRadius: deckZoom,
            data: (layer as ScatterplotLayer).props.updateTriggers?.data,
          },
          ...matrixProps,
        })
        scatterByLayerId.set(lid, {
          source: layer,
          styleKey: sk,
          modelMatrix,
          deckZoom,
          highRes,
          styled,
        })
        uidStyled.push(styled)
      } else {
        uidStyled.push(
          matrixProps.modelMatrix != null ? layer.clone(matrixProps) : layer,
        )
      }
    }
    if (hasScatterMarkers) {
      for (const lid of scatterByLayerId.keys()) {
        if (!activeScatterLayerIds.has(lid)) {
          scatterByLayerId.delete(lid)
        }
      }
      cache.set(uid, {
        sourceLayers: slice.layers,
        modelMatrix,
        styleKey: sk,
        deckZoom,
        result: uidStyled,
        scatterByLayerId,
      })
    } else {
      cache.set(uid, {
        sourceLayers: slice.layers,
        modelMatrix,
        styleKey: sk,
        deckZoom,
        result: uidStyled,
      })
    }
    out.push(...uidStyled)
  }
  for (const uid of cache.keys()) {
    if (!visibleUIDs.has(uid)) {
      cache.delete(uid)
    }
  }
  return out
}

const orthographicView = new OrthographicView({ flipY: false })

/** Mirror slide in X so Viv matches OpenLayers left–right (Deck vs OL world +X). */
function vivHorizontalFlipMatrix(worldWidth: number): Matrix4 {
  return new Matrix4().translate([worldWidth, 0, 0]).scale([-1, 1, 1])
}

type MultiscaleBuild = {
  layer: Layer
  worldW: number
  worldH: number
  levelCount: number
  initialViewTarget: [number, number, number]
}

/** Stable empty defaults — avoid `props = new Set()` / `{}` per render. */
const EMPTY_VISIBLE_BULK_GROUPS = new Set<string>()
const EMPTY_BULK_GROUP_STYLES: Record<
  string,
  { opacity: number; color: number[] }
> = {}

type ViewState = { target: [number, number, number]; zoom: number }

function bulkSliceMatchesLodMode(
  slice: VivBulkAnnotationLayerSlice | undefined,
  mode: 'centers' | 'full',
): boolean {
  if (slice == null || slice.layers.length === 0) {
    return false
  }
  if (mode === 'centers') {
    return slice.layers.some((layer) =>
      isBulkVivCenterLayerId(String(layer.id)),
    )
  }
  return slice.layers.some((layer) => isBulkVivPathLayerId(String(layer.id)))
}

/**
 * Viv + Deck.gl viewport for DICOM SM (proof-of-concept).
 * See src/viv/README.md for limitations.
 */
const VivSlideViewport: React.FC<VivSlideViewportProps> = ({
  client,
  bulkAnnotationClient,
  loadBulkAnnotations = true,
  visibleBulkAnnotationGroupUIDs = EMPTY_VISIBLE_BULK_GROUPS,
  bulkAnnotationGroupStyles = EMPTY_BULK_GROUP_STYLES,
  onBulkAnnotationCatalogChange,
  onBulkAnnotationLoadStatusChange,
  onIccProfilesAvailabilityChange,
  studyInstanceUID,
  seriesInstanceUID,
  vivSettings,
}) => {
  const catalogCbRef = useRef(onBulkAnnotationCatalogChange)
  catalogCbRef.current = onBulkAnnotationCatalogChange
  const bulkMetadataByUidRef = useRef<
    VivBulkAnnotationCatalogPayload['metadataByGroupUID']
  >({})

  const loadStatusCbRef = useRef(onBulkAnnotationLoadStatusChange)
  loadStatusCbRef.current = onBulkAnnotationLoadStatusChange

  const bulkLoadStatusRef = useRef(EMPTY_VIV_BULK_LOAD_STATUS)
  const groupDoneTimersRef = useRef<Record<string, number>>({})
  const groupLoadStartedRef = useRef<Record<string, number>>({})

  const [bulkLoadStatus, setBulkLoadStatus] = useState(
    EMPTY_VIV_BULK_LOAD_STATUS,
  )
  const [bulkHoverTooltip, setBulkHoverTooltip] = useState<{
    x: number
    y: number
    rois: Array<{
      index: number
      roiUid: string
      attributes: Array<{ name: string; value: string }>
      seriesDescription?: string
    }>
  } | null>(null)

  const emitBulkLoadStatus = useCallback(
    (next: VivBulkAnnotationLoadStatus) => {
      bulkLoadStatusRef.current = next
      setBulkLoadStatus(next)
      loadStatusCbRef.current?.(next)
    },
    [],
  )

  const patchBulkLoadStatus = useCallback(
    (
      fn: (prev: VivBulkAnnotationLoadStatus) => VivBulkAnnotationLoadStatus,
    ) => {
      emitBulkLoadStatus(fn(bulkLoadStatusRef.current))
    },
    [emitBulkLoadStatus],
  )

  const clearBulkLoadStatus = useCallback(() => {
    for (const id of Object.values(groupDoneTimersRef.current)) {
      window.clearTimeout(id)
    }
    groupDoneTimersRef.current = {}
    groupLoadStartedRef.current = {}
    emitBulkLoadStatus(EMPTY_VIV_BULK_LOAD_STATUS)
  }, [emitBulkLoadStatus])

  const markGroupLoadDone = useCallback(
    (groupUID: string) => {
      const startedAtMs = groupLoadStartedRef.current[groupUID] ?? Date.now()
      const finishedAtMs = Date.now()
      patchBulkLoadStatus((prev) =>
        upsertVivBulkGroupLoadState(prev, groupUID, {
          phase: 'done',
          startedAtMs,
          finishedAtMs,
        }),
      )
      if (groupDoneTimersRef.current[groupUID] != null) {
        window.clearTimeout(groupDoneTimersRef.current[groupUID])
      }
      groupDoneTimersRef.current[groupUID] = window.setTimeout(() => {
        patchBulkLoadStatus((prev) =>
          removeVivBulkGroupLoadState(prev, groupUID),
        )
        delete groupDoneTimersRef.current[groupUID]
        delete groupLoadStartedRef.current[groupUID]
      }, 4000)
    },
    [patchBulkLoadStatus],
  )

  const reportGroupLoad = useCallback(
    (
      groupUID: string,
      patch: Partial<VivBulkGroupLoadState> & {
        phase: VivBulkGroupLoadPhase
      },
    ) => {
      const startedAtMs =
        patch.startedAtMs ?? groupLoadStartedRef.current[groupUID] ?? Date.now()
      groupLoadStartedRef.current[groupUID] = startedAtMs
      patchBulkLoadStatus((prev) =>
        upsertVivBulkGroupLoadState(prev, groupUID, {
          groupUID,
          startedAtMs,
          ...patch,
        }),
      )
    },
    [patchBulkLoadStatus],
  )

  const iccAvailCbRef = useRef(onIccProfilesAvailabilityChange)
  iccAvailCbRef.current = onIccProfilesAvailabilityChange

  const iccProfilesEnabled = useSyncExternalStore(
    subscribeIccProfilesEnabled,
    getIccProfilesEnabled,
    getIccProfilesEnabled,
  )
  /** Tracks last-applied ICC value so we only rebuild when the shared preference changes. */
  const iccPropRef = useRef(iccProfilesEnabled)

  const vivBulkLodEnabled = useSyncExternalStore(
    subscribeVivBulkLodPreference,
    getVivBulkLodEnabled,
    getVivBulkLodEnabled,
  )
  const vivBulkLodLevelsFromFinest = useSyncExternalStore(
    subscribeVivBulkLodPreference,
    getVivBulkLodLevelsFromFinest,
    getVivBulkLodLevelsFromFinest,
  )
  const isBulkHighRes = useCallback(
    (deckZoom: number, pyramid: BulkAnnotationGeometryContext['pyramid']) => {
      return computeVivBulkHighResolution({
        deckZoom,
        pyramid,
        lodEnabled: vivBulkLodEnabled,
        levelsFromFinest:
          vivBulkLodLevelsFromFinest ?? resolveVivBulkLodLevelsFromFinest(),
      })
    },
    [vivBulkLodEnabled, vivBulkLodLevelsFromFinest],
  )
  const isBulkHighResRef = useRef(isBulkHighRes)
  isBulkHighResRef.current = isBulkHighRes

  const vivRef = useRef(vivSettings)
  vivRef.current = vivSettings

  const slotRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<(() => void) | null>(null)
  const slideRef = useRef<{
    worldW: number
    worldH: number
    levelCount: number
  } | null>(null)
  /** Same transform as the multiscale image (bulk overlays stay aligned). */
  const slideMatrixRef = useRef<Matrix4 | null>(null)
  const fitDoneRef = useRef(false)
  /** Same loader instance that built `baseLayer` (for geometry + ANN bulk fetches only). */
  const dicomLoaderRef = useRef<DicomLoader | null>(null)
  const bulkGeometryRef = useRef<BulkAnnotationGeometryContext | null>(null)
  const bulkGroupJobsRef = useRef<Record<string, VivBulkGroupGeometryJob>>({})
  const bulkHydrateInFlightRef = useRef<Set<string>>(new Set())
  /** Incremented on unmount / series change to ignore in-flight hydrate callbacks. */
  const bulkHydrateGenRef = useRef(0)
  const bulkViewportRebuildGenRef = useRef<Record<string, number>>({})
  /** Raw bulk buffers (~tens–100s MB); kept out of React state so path layers can be released independently. */
  const bulkGraphicCacheByUidRef = useRef<Record<string, VivBulkGraphicCache>>(
    {},
  )
  const visibleBulkUidsRef = useRef(visibleBulkAnnotationGroupUIDs)
  visibleBulkUidsRef.current = visibleBulkAnnotationGroupUIDs
  const slicesByUidRef = useRef<Record<string, VivBulkAnnotationLayerSlice>>({})
  const styledOverlayCacheRef = useRef(new Map<string, StyledLayerCacheEntry>())
  /**
   * Growing centroid coordinate list per group while bulk bytes stream in.
   * Merged into one ScatterplotLayer so Deck can paint progressively instead of
   * waiting for dozens of separate GPU uploads to finish.
   */
  const streamingCentroidAccRef = useRef(new Map<string, [number, number][]>())
  const deckRef = useRef<DeckGLRef>(null)
  const imageDeckRef = useRef<DeckGLRef>(null)
  const baseLayerRef = useRef<Layer | null>(null)
  /** Tracks centers ↔ paths LOD; rebuild geometry only when this flips, not on every zoom step. */
  const bulkLodHighResRef = useRef<boolean | null>(null)
  /**
   * Last full-path rebuild attempt key per group (`zoomBucket:tx:ty`) so a failed
   * / empty path rebuild can retry after pan/zoom without looping forever.
   */
  const bulkFullPathAttemptKeyRef = useRef<Record<string, string>>({})
  const [size, setSize] = useState({ width: 100, height: 100 })
  const [baseLayer, setBaseLayer] = useState<Layer | null>(null)
  baseLayerRef.current = baseLayer
  const baseLayerReady = baseLayer !== null
  const [bulkSlicesByUid, setBulkSlicesByUid] = useState<
    Record<string, VivBulkAnnotationLayerSlice>
  >({})
  /** Bumped on each streaming centroid paint so Deck always sees a new layers prop. */
  const [bulkStreamPaintGen, setBulkStreamPaintGen] = useState(0)
  /**
   * True while one or more bulk annotation groups are hydrating — further throttle
   * Viv tile concurrency so graphicIndex / Range bulkdata share the proxy budget.
   */
  const [bulkHydrateTileThrottle, setBulkHydrateTileThrottle] = useState(false)
  /**
   * Deck layers for groups actively streaming bulk bytes. Kept separate from
   * `bulkSlicesByUid` so Viv tile updates on the image Deck cannot clobber them.
   */
  const [streamingDeckOverlaysByUid, setStreamingDeckOverlaysByUid] = useState<
    Record<string, Layer[]>
  >({})
  const [bulkDefaultStyles, setBulkDefaultStyles] = useState<
    Record<string, { opacity: number; color: number[] }>
  >({})
  slicesByUidRef.current = bulkSlicesByUid
  const bulkAnnotationGroupStylesRef = useRef(bulkAnnotationGroupStyles)
  bulkAnnotationGroupStylesRef.current = bulkAnnotationGroupStyles
  const bulkDefaultStylesRef = useRef(bulkDefaultStyles)
  bulkDefaultStylesRef.current = bulkDefaultStyles

  const [loading, setLoading] = useState(true)
  const [viewState, setViewState] = useState<ViewState>({
    target: [0, 0, 0],
    zoom: -6,
  })
  const sizeRef = useRef(size)
  sizeRef.current = size
  const viewStateRef = useRef(viewState)
  viewStateRef.current = viewState

  const runBulkViewportRebuildForGroup = useCallback(
    (uid: string, options?: { quiet?: boolean; force?: boolean }) => {
      const cache = bulkGraphicCacheByUidRef.current[uid]
      const geom = bulkGeometryRef.current
      const sr = slideRef.current
      if (cache == null || geom == null || sr == null) {
        return
      }
      const quiet = options?.quiet === true
      const force = options?.force === true
      const job = bulkGroupJobsRef.current[uid]
      const vs = viewStateRef.current
      const { width: vw, height: vh } = sizeRef.current
      const highRes = isBulkHighRes(vs.zoom, geom.pyramid)
      const mode = highRes ? 'full' : 'centers'

      const prevSlice = slicesByUidRef.current[uid]
      if (!force && bulkSliceMatchesLodMode(prevSlice, mode)) {
        vivBulkAnnDebug('viewport:LOD skip rebuild (layers already loaded)', {
          uid,
          mode,
          layerCount: prevSlice?.layers.length ?? 0,
        })
        return
      }

      /** Overview centroids: decode all markers once. Paths: cull to current viewport. */
      const viewportBounds =
        mode === 'centers'
          ? undefined
          : deckViewportBoundsFromViewState(
              sr.worldW,
              sr.worldH,
              vw,
              vh,
              vs.target,
              vs.zoom,
            )
      /**
       * Keep the currently-rendered layers (e.g. the streaming centroid preview,
       * or the previous LOD layers on pan/zoom) on screen until the first rebuilt
       * chunk is ready, then swap atomically. Clearing eagerly here is what caused
       * the brief "everything disappears, then reappears at once" flash. Layers
       * dropped from the slice on swap are finalized by deck.gl on the next render.
       *
       * Always clear `streamPreview` when entering full paths so the slice is no
       * longer treated as a locked centroid overlay (which blocked path upgrades).
       */
      if (mode === 'full' && prevSlice?.streamPreview === true) {
        const cleared: VivBulkAnnotationLayerSlice = {
          groupUID: uid,
          graphicType: prevSlice.graphicType,
          supportsLod: prevSlice.supportsLod,
          layers: prevSlice.layers,
        }
        slicesByUidRef.current = {
          ...slicesByUidRef.current,
          [uid]: cleared,
        }
        setBulkSlicesByUid((prev) => ({
          ...prev,
          [uid]: cleared,
        }))
      }
      styledOverlayCacheRef.current.delete(uid)

      const gen = (bulkViewportRebuildGenRef.current[uid] ?? 0) + 1
      bulkViewportRebuildGenRef.current[uid] = gen

      vivBulkAnnPhase('viewport:LOD viewport rebuild dispatch', {
        uid,
        mode,
        gen,
      })

      if (!quiet) {
        reportGroupLoad(uid, {
          phase: 'processing',
          startedAtMs: groupLoadStartedRef.current[uid] ?? Date.now(),
          annotationCount: job?.numberOfAnnotations,
          graphicType: cache.graphicType,
          detail:
            mode === 'centers'
              ? 'Rendering overview markers…'
              : 'Rendering annotation paths…',
        })
      }

      let chunksCommitted = 0
      /** Outside setState — React may double-invoke updaters in Strict Mode. */
      let swappedPriorLayers = false
      const appendChunkToSlice = (chunkLayers: Layer[]): void => {
        /**
         * Skip empty chunks while still holding the prior LOD overlay. The first
         * non-empty chunk replaces prior layers; later chunks append.
         */
        if (!swappedPriorLayers) {
          if (chunkLayers.length === 0) {
            return
          }
          swappedPriorLayers = true
          setBulkSlicesByUid((prev) => {
            const existing = prev[uid]
            const nextSlice: VivBulkAnnotationLayerSlice = {
              groupUID: uid,
              graphicType: existing?.graphicType ?? cache.graphicType,
              supportsLod: existing?.supportsLod ?? true,
              layers: [...chunkLayers],
            }
            slicesByUidRef.current = {
              ...slicesByUidRef.current,
              [uid]: nextSlice,
            }
            return {
              ...prev,
              [uid]: nextSlice,
            }
          })
          return
        }
        setBulkSlicesByUid((prev) => {
          const existing = prev[uid]
          const nextSlice: VivBulkAnnotationLayerSlice = {
            groupUID: uid,
            graphicType: existing?.graphicType ?? cache.graphicType,
            supportsLod: existing?.supportsLod ?? true,
            layers: [...(existing?.layers ?? []), ...chunkLayers],
          }
          slicesByUidRef.current = {
            ...slicesByUidRef.current,
            [uid]: nextSlice,
          }
          return {
            ...prev,
            [uid]: nextSlice,
          }
        })
      }

      void rebuildVivBulkLayersForViewport({
        cache,
        viewportBounds,
        mode,
        deckZoom: vs.zoom,
        viewportWidth: vw,
        viewportHeight: vh,
        slideWidth: sr.worldW,
        slideHeight: sr.worldH,
        deckLoadCenter: deckLoadCenterFromViewTarget(sr.worldW, vs.target),
        shouldContinue: () =>
          visibleBulkUidsRef.current.has(uid) &&
          bulkViewportRebuildGenRef.current[uid] === gen,
        onChunk: (chunkLayers, meta) => {
          if (
            bulkViewportRebuildGenRef.current[uid] !== gen ||
            !visibleBulkUidsRef.current.has(uid)
          ) {
            return
          }
          chunksCommitted++
          vivBulkAnnPhase('viewport:LOD chunk commit', {
            uid,
            chunkIndex: meta.chunkIndex,
            chunkLayers: chunkLayers.length,
            mode,
          })
          if (!quiet) {
            reportGroupLoad(uid, {
              phase: 'processing',
              startedAtMs: groupLoadStartedRef.current[uid] ?? Date.now(),
              chunkIndex: meta.chunkIndex,
              estimatedChunks: meta.estimatedTotalChunks,
              annotationCount: job?.numberOfAnnotations,
              graphicType: cache.graphicType,
            })
          }
          appendChunkToSlice(chunkLayers)
        },
      })
        .then((layers) => {
          if (bulkViewportRebuildGenRef.current[uid] !== gen) {
            return
          }
          if (!visibleBulkUidsRef.current.has(uid)) {
            return
          }
          vivBulkAnnPhase('viewport:LOD viewport rebuild done', {
            uid,
            mode,
            layerCount: layers.length,
            chunksCommitted,
          })
          if (chunksCommitted === 0) {
            // No streamed chunks: swap the full result in atomically — but never
            // replace an existing centroid overview with an empty path result
            // (that left high-zoom views with neither centroids nor polygons).
            setBulkSlicesByUid((prev) => {
              const existing = prev[uid]
              if (layers.length === 0 && (existing?.layers.length ?? 0) > 0) {
                vivBulkAnnDebug(
                  'viewport:LOD keep prior layers (empty full rebuild)',
                  { uid, mode, priorLayers: existing?.layers.length ?? 0 },
                )
                // Allow the next pan/zoom attempt key to retry this region.
                delete bulkFullPathAttemptKeyRef.current[uid]
                return prev
              }
              const nextSlice: VivBulkAnnotationLayerSlice = {
                groupUID: uid,
                graphicType: existing?.graphicType ?? cache.graphicType,
                supportsLod: existing?.supportsLod ?? true,
                layers,
              }
              slicesByUidRef.current = {
                ...slicesByUidRef.current,
                [uid]: nextSlice,
              }
              return {
                ...prev,
                [uid]: nextSlice,
              }
            })
          }
          if (!quiet) {
            markGroupLoadDone(uid)
          }
        })
        .catch((e) => {
          vivBulkAnnDebug('viewport:LOD viewport rebuild failed', {
            uid,
            err: e instanceof Error ? e.message : String(e),
          })
        })
    },
    [markGroupLoadDone, reportGroupLoad, isBulkHighRes],
  )
  const runBulkViewportRebuildForGroupRef = useRef(
    runBulkViewportRebuildForGroup,
  )
  runBulkViewportRebuildForGroupRef.current = runBulkViewportRebuildForGroup

  const createMultiscaleFromLoader = useCallback(
    async (dicomLoader: DicomLoader): Promise<MultiscaleBuild> => {
      const sources = await dicomLoader.getSources()
      if (sources.length === 0) {
        throw new Error('No pyramid levels returned for this series.')
      }
      const [, sh, sw] = sources[0].shape
      const bitsAllocated = dicomLoader.bitsAllocated ?? 16
      const d = buildVivDisplayOptions(
        sh,
        sw,
        sources[0].shape[0],
        vivRef.current,
        bitsAllocated,
      )
      const iccOn = getIccProfilesEnabled()
      const excludeBackground =
        !vivCoarsestLevelSupportsBackgroundRaster(sources)
      const layer = new MultiscaleImageLayer({
        id: `slim-viv-multiscale-icc-${iccOn ? 'on' : 'off'}`,
        pickable: false,
        loader: sources as never,
        modelMatrix: vivHorizontalFlipMatrix(sw),
        selections: d.selections,
        channelsVisible: d.channelsVisible,
        contrastLimits: d.contrastLimits,
        dtype: sources[0].dtype,
        /** One coarse getRaster when the pyramid fits a single tile (not RGB-only block). */
        excludeBackground,
        /**
         * Keep concurrent JP2 tile GETs modest so IDC/GCP proxies do not 429 the
         * LongPrimitivePointIndexList fetch that must succeed before progressive hydrate.
         */
        maxRequests: 12,
        /**
         * Viv tile payloads are { data, width, height } without top-level byteLength — do not
         * set maxCacheByteSize (deck.gl logs errors and cache accounting breaks).
         */
        maxCacheSize: 512,
        debounceTime: 0,
        /** Passed through to deck.gl TileLayer (not in @vivjs/layers types). */
        TilesetClass: CenterOutTileset2D,
        onTileError: (err: Error) => {
          if (isVivDicomTileNetworkCancellation(err)) {
            return
          }
          logger.error(err)
        },
      } as ConstructorParameters<typeof MultiscaleImageLayer>[0])
      return {
        layer: layer as unknown as Layer,
        worldW: sw,
        worldH: sh,
        levelCount: sources.length,
        initialViewTarget: d.initialViewState.target,
      }
    },
    [],
  )

  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el) {
      return
    }
    const tick = (): void => {
      const w = Math.max(1, el.clientWidth)
      const h = Math.max(1, el.clientHeight)
      setSize({ width: w, height: h })
      const v = vivRef.current
      const sp = slideRef.current
      if (v?.initialViewState?.zoom != null || !sp || fitDoneRef.current) {
        return
      }
      const pan = v?.initialViewState?.target
      const fit = computeOrthographicFitViewState(
        w,
        h,
        sp.worldW,
        sp.worldH,
        pan,
      )
      if (fit) {
        setViewState(fit)
        fitDoneRef.current = true
      }
    }
    measureRef.current = tick
    const ro = new ResizeObserver(tick)
    ro.observe(el)
    tick()
    return () => {
      ro.disconnect()
      measureRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const hydrateInFlight = bulkHydrateInFlightRef.current
    fitDoneRef.current = false
    slideRef.current = null
    slideMatrixRef.current = null
    setLoading(true)
    setBaseLayer(null)
    setBulkSlicesByUid({})
    setBulkDefaultStyles({})
    bulkGeometryRef.current = null
    bulkGroupJobsRef.current = {}
    bulkGraphicCacheByUidRef.current = {}
    bulkViewportRebuildGenRef.current = {}
    streamingCentroidAccRef.current.clear()
    bulkHydrateGenRef.current += 1
    hydrateInFlight.clear()
    bulkLodHighResRef.current = null
    styledOverlayCacheRef.current.clear()
    bulkMetadataByUidRef.current = {}
    setBulkHoverTooltip(null)
    catalogCbRef.current?.(null)
    clearBulkLoadStatus()
    dicomLoaderRef.current?.dispose()
    dicomLoaderRef.current = null
    /**
     * Do not call onIccProfilesAvailabilityChange(false) here — it disabled the Settings
     * switch until metadata loaded (looked "off"). CaseViewer defaults to true until
     * we know this slide cannot use ICC (see getIccProfilesLength + spp).
     */

    const run = async (): Promise<void> => {
      try {
        const iccAtStart = getIccProfilesEnabled()
        const dicomLoader = new DicomLoader(
          client,
          {
            studyInstanceUID,
            seriesInstanceUID,
          },
          { iccProfilesEnabled: iccAtStart },
        )
        dicomLoaderRef.current = dicomLoader
        let built = await createMultiscaleFromLoader(dicomLoader)
        if (cancelled) {
          return
        }
        if (getIccProfilesEnabled() !== iccAtStart) {
          dicomLoader.setIccProfilesEnabled(getIccProfilesEnabled())
          await dicomLoader.warmIccTileLoaders()
          built = await createMultiscaleFromLoader(dicomLoader)
          if (cancelled) {
            return
          }
        }

        setBaseLayer(built.layer)
        slideRef.current = {
          worldW: built.worldW,
          worldH: built.worldH,
          levelCount: built.levelCount,
        }
        slideMatrixRef.current = vivHorizontalFlipMatrix(built.worldW)
        const sh = built.worldH
        const sw = built.worldW
        const sourcesLength = built.levelCount

        if (vivRef.current?.initialViewState?.zoom != null) {
          const el = slotRef.current
          const vw = el ? Math.max(1, el.clientWidth) : 800
          const vh = el ? Math.max(1, el.clientHeight) : 600
          const lim = orthographicZoomLimits(vw, vh, sw, sh, sourcesLength)
          const z0 = vivRef.current.initialViewState.zoom
          const z = Math.min(lim.maxZoom, Math.max(lim.minZoom, z0))
          setViewState({
            target: built.initialViewTarget,
            zoom: Number(z.toFixed(5)),
          })
        } else {
          const el = slotRef.current
          const vw = el ? Math.max(1, el.clientWidth) : 800
          const vh = el ? Math.max(1, el.clientHeight) : 600
          const fit = computeOrthographicFitViewState(
            vw,
            vh,
            sw,
            sh,
            vivRef.current?.initialViewState?.target,
          )
          setViewState(
            fit ?? {
              target: [sw / 2, sh / 2, 0],
              zoom: -6,
            },
          )
        }
        requestAnimationFrame(() => {
          measureRef.current?.()
        })

        iccPropRef.current = getIccProfilesEnabled()
        try {
          const n = await dicomLoader.getIccProfilesLength()
          if (!cancelled) {
            const spp = dicomLoader.samplesPerPixel ?? 1
            /**
             * Match SlideViewer when profiles exist; also allow RGB slides when getICCProfiles()
             * is still empty (hidden OL viewer timing) so the Settings toggle is usable.
             */
            iccAvailCbRef.current?.(n > 0 || spp === 3)
          }
        } catch {
          if (!cancelled) {
            const spp = dicomLoader.samplesPerPixel ?? 1
            iccAvailCbRef.current?.(spp === 3)
          }
        }
      } catch (err) {
        logger.error(err)
        if (!cancelled) {
          iccAvailCbRef.current?.(false)
          void message.error(
            err instanceof Error
              ? err.message
              : 'Failed to open slide in Viv viewer.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      bulkHydrateGenRef.current += 1
      hydrateInFlight.clear()
      bulkLodHighResRef.current = null
      terminateCenterOutAnnotationOrderWorker()
      clearBulkLoadStatus()
      dicomLoaderRef.current?.dispose()
      dicomLoaderRef.current = null
    }
  }, [
    client,
    studyInstanceUID,
    seriesInstanceUID,
    createMultiscaleFromLoader,
    clearBulkLoadStatus,
  ])

  useEffect(() => {
    if (loading) {
      return
    }
    const dl = dicomLoaderRef.current
    if (dl == null) {
      return
    }
    if (iccPropRef.current === iccProfilesEnabled) {
      return
    }
    const prevIccSynced = iccPropRef.current
    let cancelled = false
    void (async () => {
      dl.setIccProfilesEnabled(iccProfilesEnabled)
      await dl.warmIccTileLoaders()
      try {
        const built = await createMultiscaleFromLoader(dl)
        if (cancelled) {
          return
        }
        iccPropRef.current = iccProfilesEnabled
        setBaseLayer(built.layer)
        slideRef.current = {
          worldW: built.worldW,
          worldH: built.worldH,
          levelCount: built.levelCount,
        }
        slideMatrixRef.current = vivHorizontalFlipMatrix(built.worldW)
        requestAnimationFrame(() => {
          measureRef.current?.()
        })
      } catch (err) {
        logger.error(err)
        iccPropRef.current = prevIccSynced
        dl.setIccProfilesEnabled(prevIccSynced)
        try {
          await dl.warmIccTileLoaders()
          const restored = await createMultiscaleFromLoader(dl)
          if (!cancelled) {
            setBaseLayer(restored.layer)
            slideRef.current = {
              worldW: restored.worldW,
              worldH: restored.worldH,
              levelCount: restored.levelCount,
            }
            slideMatrixRef.current = vivHorizontalFlipMatrix(restored.worldW)
            requestAnimationFrame(() => {
              measureRef.current?.()
            })
            setIccProfilesEnabled(prevIccSynced)
          }
        } catch (restoreErr) {
          logger.error(restoreErr)
        }
        if (!cancelled) {
          void message.error(
            err instanceof Error
              ? err.message
              : 'Failed to update ICC color management.',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [iccProfilesEnabled, loading, createMultiscaleFromLoader])

  useEffect(() => {
    if (!loadBulkAnnotations) {
      setBulkSlicesByUid({})
      setBulkDefaultStyles({})
      bulkGeometryRef.current = null
      bulkGroupJobsRef.current = {}
      bulkHydrateInFlightRef.current.clear()
      bulkLodHighResRef.current = null
      catalogCbRef.current?.(null)
      clearBulkLoadStatus()
      return
    }
    if (!baseLayerReady) {
      setBulkSlicesByUid({})
      setBulkDefaultStyles({})
      return
    }
    const dicomLoader = dicomLoaderRef.current
    if (dicomLoader === null) {
      logger.warn(
        'viewport: no DicomLoader ref — wait for slide to finish loading',
      )
      return
    }

    let cancelled = false
    const metadataStartedAtMs = Date.now()
    patchBulkLoadStatus((prev) => ({
      ...prev,
      metadataPhase: 'loading',
      metadataStartedAtMs,
      metadataFinishedAtMs: undefined,
      metadataGroupCount: undefined,
    }))
    logger.log('viewport: loading overlays (image layer unchanged)…', {
      studyInstanceUID,
      seriesInstanceUID,
      usesDedicatedAnnClient:
        bulkAnnotationClient != null && bulkAnnotationClient !== client,
    })

    const run = async (): Promise<void> => {
      try {
        const tGeo0 = vivBulkAnnNow()
        vivBulkAnnPhase('viewport:METADATA pipeline start', {
          studyInstanceUID,
          seriesInstanceUID,
        })
        vivBulkAnnDebug('viewport: getBulkAnnotationGeometryContext …')
        const geometry = await dicomLoader.getBulkAnnotationGeometryContext()
        vivBulkAnnPerf('viewport:getBulkAnnotationGeometryContext', tGeo0, {})

        const tCat0 = vivBulkAnnNow()
        vivBulkAnnDebug('viewport: loadBulkAnnotationMetadataAndJobs …')
        const loaded = await loadBulkAnnotationMetadataAndJobs({
          geometry,
          studyInstanceUID,
          imageSeriesInstanceUID: seriesInstanceUID,
          annotationClient: bulkAnnotationClient ?? client,
          fetchClient: client,
        })
        vivBulkAnnPerf(
          'viewport:loadBulkAnnotationMetadataAndJobs (full catalog)',
          tCat0,
          {
            groups: loaded.annotationGroups.length,
          },
        )
        if (!cancelled) {
          const { groupGeometryJobs, ...catalog } = loaded
          bulkGeometryRef.current = geometry
          bulkGroupJobsRef.current = groupGeometryJobs
          bulkHydrateInFlightRef.current.clear()
          setBulkSlicesByUid({})
          setBulkDefaultStyles(loaded.defaultStylesByGroupUID)
          bulkMetadataByUidRef.current = catalog.metadataByGroupUID
          catalogCbRef.current?.(catalog)
          patchBulkLoadStatus((prev) => ({
            ...prev,
            metadataPhase: 'done',
            metadataStartedAtMs,
            metadataFinishedAtMs: Date.now(),
            metadataGroupCount: loaded.annotationGroups.length,
          }))
          vivBulkAnnPhase(
            'viewport:METADATA pipeline done — geometry + catalog ready, hydration deferred',
            {
              annotationGroups: loaded.annotationGroups.length,
              lazyGeometryJobs: Object.keys(groupGeometryJobs).length,
              totalMs: Math.round((vivBulkAnnNow() - tGeo0) * 10) / 10,
            },
          )
          logger.log('viewport: metadata catalog ready', {
            annotationGroups: loaded.annotationGroups.length,
            lazyGeometryJobs: Object.keys(groupGeometryJobs).length,
          })
        }
      } catch (e) {
        logger.warn('viewport: overlay load failed', e)
        if (!cancelled) {
          bulkGeometryRef.current = null
          bulkGroupJobsRef.current = {}
          bulkHydrateInFlightRef.current.clear()
          setBulkSlicesByUid({})
          setBulkDefaultStyles({})
          patchBulkLoadStatus((prev) => ({
            ...prev,
            metadataPhase: 'error',
            metadataStartedAtMs,
            metadataFinishedAtMs: Date.now(),
          }))
          catalogCbRef.current?.({
            annotationGroups: [],
            metadataByGroupUID: {},
            defaultStylesByGroupUID: {},
          })
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      bulkHydrateGenRef.current += 1
    }
  }, [
    loadBulkAnnotations,
    baseLayerReady,
    bulkAnnotationClient,
    client,
    studyInstanceUID,
    seriesInstanceUID,
    patchBulkLoadStatus,
    clearBulkLoadStatus,
  ])

  const paintBulkDeckLayersNow = useCallback((): void => {
    const deck = deckRef.current?.deck
    if (deck == null) {
      return
    }
    deck.redraw('bulk-stream-chunk')
  }, [])

  /** Yield a macrotask + frame so Deck can composite before the next decode batch. */
  const yieldForStreamPaint = useCallback(async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })
  }, [])

  useEffect(() => {
    if (!loadBulkAnnotations || !baseLayerReady) {
      return
    }
    const geom = bulkGeometryRef.current
    const jobs = bulkGroupJobsRef.current
    if (geom == null || Object.keys(jobs).length === 0) {
      return
    }

    const hydrateGen = bulkHydrateGenRef.current
    const hydrateInFlight = bulkHydrateInFlightRef.current
    const dispatchedUids: string[] = []
    const tBatch0 = vivBulkAnnNow()
    const batchPromises: Promise<void>[] = []
    for (const uid of visibleBulkAnnotationGroupUIDs) {
      if (slicesByUidRef.current[uid] != null) {
        continue
      }
      if (hydrateInFlight.has(uid)) {
        continue
      }
      const job = jobs[uid]
      if (job == null) {
        continue
      }
      hydrateInFlight.add(uid)
      streamingCentroidAccRef.current.delete(uid)
      setStreamingDeckOverlaysByUid((prev) => {
        if (prev[uid] == null) {
          return prev
        }
        const next = { ...prev }
        delete next[uid]
        return next
      })
      dispatchedUids.push(uid)
      const tHydr0 = vivBulkAnnNow()
      vivBulkAnnPhase('viewport:HYDRATE dispatch', {
        uid,
        graphicType: job.graphicType,
        numberOfAnnotations: job.numberOfAnnotations,
      })
      reportGroupLoad(uid, {
        phase: 'fetching',
        startedAtMs: Date.now(),
        annotationCount: job.numberOfAnnotations,
        graphicType: job.graphicType,
      })
      let chunksCommitted = 0
      let fetchUiEnded = false
      /** Throttle download-progress UI updates (streaming fires very frequently). */
      let lastProgressReportBytes = 0
      /** flushSync every Nth stream paint so Deck shows growth without locking input. */
      let streamPaintSerial = 0
      const appendChunkToSlice = async (
        chunkLayers: Layer[],
      ): Promise<void> => {
        const commitSlice = async (
          nextSlice: VivBulkAnnotationLayerSlice,
        ): Promise<void> => {
          streamPaintSerial += 1
          const apply = (): void => {
            const next = { ...slicesByUidRef.current, [uid]: nextSlice }
            slicesByUidRef.current = next
            setBulkSlicesByUid(next)
            setBulkStreamPaintGen((g) => g + 1)
          }
          // First paint + every 8th: force a frame. Other updates stay async so
          // wheel/pan on the overlay controller can run between decode batches.
          if (streamPaintSerial === 1 || streamPaintSerial % 8 === 0) {
            flushSync(apply)
          } else {
            apply()
          }
          paintBulkDeckLayersNow()
          await yieldForStreamPaint()
        }

        const centroidChunks = chunkLayers.filter(isBulkVivCentroidStreamLayer)
        const otherChunks = chunkLayers.filter(
          (layer) => !isBulkVivCentroidStreamLayer(layer),
        )

        if (centroidChunks.length > 0) {
          let acc = streamingCentroidAccRef.current.get(uid)
          if (acc == null) {
            acc = []
            streamingCentroidAccRef.current.set(uid, acc)
          }
          for (const layer of centroidChunks) {
            const data = (layer as ScatterplotLayer<[number, number]>).props
              .data as [number, number][]
            /**
             * Never `push(...data)` — a Range-ignored paint-once layer can hold
             * hundreds of thousands of points and blows the call stack / hangs.
             */
            const offset = acc.length
            acc.length = offset + data.length
            for (let i = 0; i < data.length; i++) {
              const point = data[i]
              if (point != null) {
                acc[offset + i] = point
              }
            }
          }

          const st = bulkAnnotationGroupStylesRef.current[uid] ??
            bulkDefaultStylesRef.current[uid] ?? {
              opacity: 1,
              color: [...VIV_BULK_DEFAULT_OVERLAY_COLOR],
            }
          const a = Math.round(Math.max(0, Math.min(1, st.opacity)) * 220)
          const rgba: [number, number, number, number] = [
            st.color[0] ?? VIV_BULK_DEFAULT_OVERLAY_COLOR[0],
            st.color[1] ?? VIV_BULK_DEFAULT_OVERLAY_COLOR[1],
            st.color[2] ?? VIV_BULK_DEFAULT_OVERLAY_COLOR[2],
            a,
          ]
          const geomNow = bulkGeometryRef.current
          const srNow = slideRef.current
          const vsNow = viewStateRef.current
          const { width: vw, height: vh } = sizeRef.current
          const radiusPx = computeVivBulkCentroidRadiusPixels({
            deckZoom: vsNow.zoom,
            pixelSpacingMm:
              geomNow != null
                ? readFinestPyramidPixelSpacingMm(geomNow.pyramid)
                : null,
            lodOverview: true,
            viewportWidth: vw,
            viewportHeight: vh,
            slideWidth: srNow?.worldW,
            slideHeight: srNow?.worldH,
          })
          const matrix = slideMatrixRef.current
          const pointCount = acc.length
          const deckLayer = new ScatterplotLayer<[number, number]>({
            id: `viv-bulk-${uid}-centers-${pointCount}`,
            data: acc.slice(),
            pickable: true,
            getPosition: (d) => d,
            getFillColor: () => rgba,
            getRadius: () => radiusPx,
            radiusMinPixels: 1,
            radiusUnits: 'pixels',
            updateTriggers: { data: pointCount, getRadius: radiusPx },
            ...(matrix != null ? { modelMatrix: matrix } : {}),
          }) as unknown as Layer

          styledOverlayCacheRef.current.delete(uid)
          setStreamingDeckOverlaysByUid((prev) => ({
            ...prev,
            [uid]: [deckLayer],
          }))
          await commitSlice({
            groupUID: uid,
            graphicType: job.graphicType,
            supportsLod: true,
            streamPreview: true,
            layers: [deckLayer],
          })
          return
        }

        if (otherChunks.length === 0) {
          return
        }
        // Path chunks (high-res LOD upgrade): drop centroid stream overlay and
        // replace — never append polygons onto a streamPreview centers layer.
        const existing = slicesByUidRef.current[uid]
        const existingLayers = existing?.layers
        const upgradingFromCentroids =
          existing?.streamPreview === true ||
          (existingLayers != null &&
            existingLayers.length > 0 &&
            existingLayers.every((layer) =>
              isBulkVivCentroidStreamLayer(layer),
            ))
        if (upgradingFromCentroids) {
          streamingCentroidAccRef.current.delete(uid)
          setStreamingDeckOverlaysByUid((prev) => {
            if (prev[uid] == null) {
              return prev
            }
            const next = { ...prev }
            delete next[uid]
            return next
          })
          await commitSlice({
            groupUID: uid,
            graphicType: job.graphicType,
            supportsLod: true,
            streamPreview: false,
            layers: [...otherChunks],
          })
          return
        }
        const layers = existing
          ? [...existing.layers, ...otherChunks]
          : [...otherChunks]
        await commitSlice({
          groupUID: uid,
          graphicType: job.graphicType,
          supportsLod: true,
          streamPreview: false,
          layers,
        })
      }
      const sr = slideRef.current
      const vs = viewStateRef.current
      const { width: vw, height: vh } = sizeRef.current
      const deckLoadCenter =
        sr != null
          ? deckLoadCenterFromViewTarget(sr.worldW, vs.target)
          : undefined
      const viewportBounds =
        sr != null
          ? deckViewportBoundsFromViewState(
              sr.worldW,
              sr.worldH,
              vw,
              vh,
              vs.target,
              vs.zoom,
            )
          : undefined
      const lodPreviewContext =
        sr != null
          ? {
              deckZoom: vs.zoom,
              viewportWidth: vw,
              viewportHeight: vh,
              slideWidth: sr.worldW,
              slideHeight: sr.worldH,
              getDeckZoom: (): number => viewStateRef.current.zoom,
              isHighResolution: (): boolean => {
                const g = bulkGeometryRef.current
                if (g == null) {
                  return false
                }
                return isBulkHighResRef.current(
                  viewStateRef.current.zoom,
                  g.pyramid,
                )
              },
              getViewportBounds: ():
                | ReturnType<typeof deckViewportBoundsFromViewState>
                | undefined => {
                const slide = slideRef.current
                if (slide == null) {
                  return undefined
                }
                const vsNow = viewStateRef.current
                const { width: bw, height: bh } = sizeRef.current
                return deckViewportBoundsFromViewState(
                  slide.worldW,
                  slide.worldH,
                  bw,
                  bh,
                  vsNow.target,
                  vsNow.zoom,
                )
              },
            }
          : undefined
      batchPromises.push(
        hydrateVivBulkGroupLayerSlice({
          job,
          geometry: geom,
          fetchClient: client,
          deckLoadCenter,
          viewportBounds,
          lodPreviewContext,
          onFetchComplete: () => {
            reportGroupLoad(uid, {
              phase: 'processing',
              detail: 'Decoding annotations…',
              annotationCount: job.numberOfAnnotations,
              graphicType: job.graphicType,
            })
          },
          /**
           * Streaming download progress. Throttled to ~8 MB steps so the bulk
           * load indicator advances without flooding React with state updates.
           */
          onFetchProgress: (loadedBytes, totalBytes) => {
            if (
              bulkHydrateGenRef.current !== hydrateGen ||
              !visibleBulkUidsRef.current.has(uid)
            ) {
              return
            }
            const atEnd = totalBytes != null && loadedBytes >= totalBytes
            if (
              !atEnd &&
              loadedBytes - lastProgressReportBytes < 8 * 1024 * 1024
            ) {
              return
            }
            lastProgressReportBytes = loadedBytes
            const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1)
            const totalMb =
              totalBytes != null && totalBytes > 0
                ? ` / ${(totalBytes / (1024 * 1024)).toFixed(1)}`
                : ''
            reportGroupLoad(uid, {
              phase: 'fetching',
              detail: `Downloading annotations… ${loadedMb}${totalMb} MB`,
              annotationCount: job.numberOfAnnotations,
              graphicType: job.graphicType,
            })
          },
          /**
           * Polled at every chunk boundary so hydrate stops decoding the
           * remaining polygons when the user toggles the group off.
           */
          shouldContinue: () =>
            bulkHydrateGenRef.current === hydrateGen &&
            visibleBulkUidsRef.current.has(uid),
          /**
           * Progressive rendering: hydrate calls back as soon as a chunk is
           * decoded — full path/point chunks for smaller groups, or lightweight
           * centroid markers for large LOD groups streamed as bytes arrive — so
           * the user sees partial coverage while the rest of the transfer +
           * decode is still running. For LOD groups these preview layers are
           * replaced by the viewport rebuild once the full buffer is cached.
           */
          onChunk: async (chunkLayers, meta) => {
            if (
              bulkHydrateGenRef.current !== hydrateGen ||
              !visibleBulkUidsRef.current.has(uid)
            ) {
              vivBulkAnnDebug('viewport: chunk dropped (no longer visible)', {
                uid,
                chunkIndex: meta.chunkIndex,
              })
              return
            }
            chunksCommitted++
            if (!fetchUiEnded) {
              fetchUiEnded = true
              reportGroupLoad(uid, {
                phase: 'processing',
                detail: 'Rendering annotations…',
                annotationCount: job.numberOfAnnotations,
                graphicType: job.graphicType,
              })
            }
            const tSet0 = vivBulkAnnNow()
            vivBulkAnnPhase('viewport:HYDRATE chunk commit', {
              uid,
              chunkIndex: meta.chunkIndex,
              estimatedTotalChunks: meta.estimatedTotalChunks,
              chunkLayers: chunkLayers.length,
              sinceDispatchMs: Math.round((vivBulkAnnNow() - tHydr0) * 10) / 10,
            })
            reportGroupLoad(uid, {
              phase: 'processing',
              chunkIndex: meta.chunkIndex,
              estimatedChunks: meta.estimatedTotalChunks,
              annotationCount: job.numberOfAnnotations,
              graphicType: job.graphicType,
            })
            await appendChunkToSlice(chunkLayers)
            vivBulkAnnDebug('viewport: chunk scheduled', {
              uid,
              chunkIndex: meta.chunkIndex,
              scheduleMs: Math.round((vivBulkAnnNow() - tSet0) * 100) / 100,
            })
          },
        }).then((slice) => {
          if (bulkHydrateGenRef.current !== hydrateGen) {
            hydrateInFlight.delete(uid)
            /**
             * Gen bump aborted this hydrate (e.g. effect re-run). If decode still
             * finished with a graphicCache, keep it so we do not drop overlays and
             * force a full re-download — then rebuild for the current LOD.
             */
            if (
              slice?.graphicCache != null &&
              visibleBulkUidsRef.current.has(uid)
            ) {
              bulkGraphicCacheByUidRef.current[uid] = slice.graphicCache
              setBulkSlicesByUid((prev) => {
                const next = {
                  ...prev,
                  [uid]: {
                    groupUID: uid,
                    graphicType: job.graphicType,
                    supportsLod: true,
                    streamPreview: false,
                    layers: prev[uid]?.layers ?? [],
                  },
                }
                slicesByUidRef.current = next
                return next
              })
              runBulkViewportRebuildForGroupRef.current(uid, {
                quiet: true,
                force: true,
              })
              markGroupLoadDone(uid)
              return
            }
            if (bulkGraphicCacheByUidRef.current[uid] == null) {
              streamingCentroidAccRef.current.delete(uid)
              setStreamingDeckOverlaysByUid((prev) => {
                if (prev[uid] == null) {
                  return prev
                }
                const next = { ...prev }
                delete next[uid]
                return next
              })
              setBulkSlicesByUid((prev) => {
                if (prev[uid] == null) {
                  return prev
                }
                const next = { ...prev }
                delete next[uid]
                slicesByUidRef.current = next
                return next
              })
            }
            return
          }
          vivBulkAnnPerf(
            'viewport:promise hydrateVivBulkGroupLayerSlice settled',
            tHydr0,
            {
              uid,
              stillVisible: visibleBulkUidsRef.current.has(uid),
              /** LOD stream returns empty layers + graphicCache by design. */
              returnedSliceLayers: slice?.layers.length ?? 0,
              hasGraphicCache: slice?.graphicCache != null,
              committedLayers: slicesByUidRef.current[uid]?.layers.length ?? 0,
              chunksCommitted,
            },
          )
          vivBulkAnnPhase('viewport:HYDRATE settled (single group)', {
            uid,
            graphicType: job.graphicType,
            numberOfAnnotations: job.numberOfAnnotations,
            returnedSliceLayers: slice?.layers.length ?? 0,
            hasGraphicCache: slice?.graphicCache != null,
            committedLayers: slicesByUidRef.current[uid]?.layers.length ?? 0,
            chunksCommitted,
            stillVisible: visibleBulkUidsRef.current.has(uid),
            hydrateMs: Math.round((vivBulkAnnNow() - tHydr0) * 10) / 10,
          })
          if (
            slice != null &&
            visibleBulkUidsRef.current.has(uid) &&
            bulkHydrateGenRef.current === hydrateGen
          ) {
            if (slice.graphicCache != null) {
              bulkGraphicCacheByUidRef.current[uid] = slice.graphicCache
              const geomNow = bulkGeometryRef.current
              const highResNow =
                geomNow != null &&
                isBulkHighResRef.current(
                  viewStateRef.current.zoom,
                  geomNow.pyramid,
                )
              const keepStreamedCentroids = !highResNow && chunksCommitted > 0
              const keptLayerCount =
                slicesByUidRef.current[uid]?.layers.length ?? 0
              /**
               * Overview: keep streamed centroids as the centers LOD result.
               * Always clear `streamPreview` so panel color/opacity restyles apply —
               * `streamPreview` must not stay true as a permanent style bypass.
               * High-res: always rebuild full paths for the current viewport
               * (streaming preview was centroids-only unless the user zoomed in
               * mid-transfer and already received path chunks).
               */
              setBulkSlicesByUid((prev) => {
                const next = {
                  ...prev,
                  [uid]: {
                    groupUID: uid,
                    graphicType: job.graphicType,
                    supportsLod: true,
                    streamPreview: false,
                    layers: prev[uid]?.layers ?? [],
                  },
                }
                slicesByUidRef.current = next
                return next
              })
              if (keepStreamedCentroids) {
                bulkLodHighResRef.current = false
                setStreamingDeckOverlaysByUid((prev) => {
                  const next = { ...prev }
                  delete next[uid]
                  return next
                })
                vivBulkAnnPhase(
                  'viewport:HYDRATE keep streamed centroid overview (skip rebuild)',
                  {
                    uid,
                    streamedChunks: chunksCommitted,
                    keptLayers: keptLayerCount,
                  },
                )
                markGroupLoadDone(uid)
              } else {
                bulkLodHighResRef.current = highResNow
                setStreamingDeckOverlaysByUid((prev) => {
                  if (prev[uid] == null) {
                    return prev
                  }
                  const next = { ...prev }
                  delete next[uid]
                  return next
                })
                reportGroupLoad(uid, {
                  phase: 'processing',
                  detail: highResNow
                    ? 'Rendering annotation paths…'
                    : 'Bulk data retrieved — preparing viewport…',
                  annotationCount: job.numberOfAnnotations,
                  graphicType: job.graphicType,
                })
                runBulkViewportRebuildForGroupRef.current(uid, { force: true })
              }
            } else if (chunksCommitted === 0) {
              startTransition(() => {
                setBulkSlicesByUid((prev) => ({
                  ...prev,
                  [uid]: {
                    groupUID: slice.groupUID,
                    graphicType: slice.graphicType,
                    supportsLod: slice.supportsLod,
                    layers: slice.layers,
                  },
                }))
              })
              markGroupLoadDone(uid)
            } else {
              markGroupLoadDone(uid)
            }
          }
          hydrateInFlight.delete(uid)
        }),
      )
    }
    if (dispatchedUids.length === 0) {
      return
    }
    vivBulkAnnPhase('viewport:HYDRATE batch start', {
      dispatched: dispatchedUids.length,
      uids: dispatchedUids,
    })
    setBulkHydrateTileThrottle(true)
    void Promise.allSettled(batchPromises).then(() => {
      if (bulkHydrateGenRef.current !== hydrateGen) {
        return
      }
      setBulkHydrateTileThrottle(false)
      vivBulkAnnPhase('viewport:HYDRATE batch done (all visible groups)', {
        dispatched: dispatchedUids.length,
        uids: dispatchedUids,
        batchMs: Math.round((vivBulkAnnNow() - tBatch0) * 10) / 10,
      })
    })
    return () => {
      bulkHydrateGenRef.current += 1
      setBulkHydrateTileThrottle(false)
      for (const uid of dispatchedUids) {
        hydrateInFlight.delete(uid)
      }
    }
    /**
     * Intentionally omit `runBulkViewportRebuildForGroup` / LOD preference deps.
     * Threshold edits recreate that callback; putting it here aborted in-flight
     * hydrates (gen bump) and cleared mid-stream overlays so status looked "done"
     * while annotations vanished. Rebuild uses `runBulkViewportRebuildForGroupRef`.
     */
  }, [
    loadBulkAnnotations,
    baseLayerReady,
    visibleBulkAnnotationGroupUIDs,
    client,
    reportGroupLoad,
    markGroupLoadDone,
    paintBulkDeckLayersNow,
    yieldForStreamPaint,
  ])

  /** Drop bulk buffers, GPU layer data, and slice state when a group is hidden. */
  useEffect(() => {
    for (const uid of Object.keys(bulkGraphicCacheByUidRef.current)) {
      if (visibleBulkAnnotationGroupUIDs.has(uid)) {
        continue
      }
      const slice = slicesByUidRef.current[uid]
      if (slice?.layers.length) {
        detachVivBulkOverlayLayerData(slice.layers)
      }
      delete bulkGraphicCacheByUidRef.current[uid]
      bulkViewportRebuildGenRef.current[uid] =
        (bulkViewportRebuildGenRef.current[uid] ?? 0) + 1
      bulkHydrateInFlightRef.current.delete(uid)
      patchBulkLoadStatus((prev) => removeVivBulkGroupLoadState(prev, uid))
      delete groupLoadStartedRef.current[uid]
    }
    setBulkSlicesByUid((prev) => {
      let next: Record<string, VivBulkAnnotationLayerSlice> | null = null
      for (const uid of Object.keys(prev)) {
        if (!visibleBulkAnnotationGroupUIDs.has(uid)) {
          const slice = prev[uid]
          if (slice?.layers.length) {
            detachVivBulkOverlayLayerData(slice.layers)
          }
          if (next === null) {
            next = { ...prev }
          }
          delete next[uid]
        }
      }
      return next ?? prev
    })
    setStreamingDeckOverlaysByUid((prev) => {
      let next: Record<string, Layer[]> | null = null
      for (const uid of Object.keys(prev)) {
        if (!visibleBulkAnnotationGroupUIDs.has(uid)) {
          if (next === null) {
            next = { ...prev }
          }
          delete next[uid]
        }
      }
      return next ?? prev
    })
  }, [visibleBulkAnnotationGroupUIDs, patchBulkLoadStatus])

  /** LOD mode flip (centers ↔ paths): rebuild geometry immediately. */
  useEffect(() => {
    if (!loadBulkAnnotations || !baseLayerReady) {
      return
    }
    const geom = bulkGeometryRef.current
    if (geom == null) {
      return
    }
    const highRes = isBulkHighRes(viewState.zoom, geom.pyramid)
    const prev = bulkLodHighResRef.current
    bulkLodHighResRef.current = highRes

    const modeFlipped = prev !== null && prev !== highRes
    if (!modeFlipped) {
      return
    }
    const zoomBucket = Math.round(viewState.zoom * 4) / 4
    const attemptKey = `${zoomBucket}:${viewState.target[0].toFixed(0)}:${viewState.target[1].toFixed(0)}`
    vivBulkAnnDebug('viewport:LOD mode flip rebuild', {
      prevHighRes: prev,
      highRes,
      zoom: viewState.zoom,
    })
    for (const uid of visibleBulkAnnotationGroupUIDs) {
      if (bulkGraphicCacheByUidRef.current[uid] == null) {
        continue
      }
      if (highRes) {
        // Mark this view so the pan/zoom effect does not immediately rebuild again.
        bulkFullPathAttemptKeyRef.current[uid] = attemptKey
      } else {
        delete bulkFullPathAttemptKeyRef.current[uid]
      }
      runBulkViewportRebuildForGroup(uid, { quiet: true, force: true })
    }
  }, [
    loadBulkAnnotations,
    baseLayerReady,
    visibleBulkAnnotationGroupUIDs,
    runBulkViewportRebuildForGroup,
    viewState.zoom,
    viewState.target,
    isBulkHighRes,
  ])

  /**
   * High-res paths are viewport-culled. Rebuild after pan / fine zoom settles so
   * newly visible polygons load. Overview centroids cover the whole slide and
   * do not need this.
   */
  useEffect(() => {
    if (!loadBulkAnnotations || !baseLayerReady) {
      return
    }
    const geom = bulkGeometryRef.current
    if (geom == null) {
      return
    }
    const highRes = isBulkHighRes(viewState.zoom, geom.pyramid)
    if (!highRes) {
      return
    }

    const zoomBucket = Math.round(viewState.zoom * 4) / 4
    const attemptKey = `${zoomBucket}:${viewState.target[0].toFixed(0)}:${viewState.target[1].toFixed(0)}`

    const timer = window.setTimeout(() => {
      const uids: string[] = []
      for (const uid of visibleBulkAnnotationGroupUIDs) {
        if (bulkGraphicCacheByUidRef.current[uid] == null) {
          continue
        }
        // Same view bucket already rebuilt (or in flight) — skip.
        if (bulkFullPathAttemptKeyRef.current[uid] === attemptKey) {
          continue
        }
        bulkFullPathAttemptKeyRef.current[uid] = attemptKey
        uids.push(uid)
      }
      if (uids.length === 0) {
        return
      }
      vivBulkAnnDebug('viewport:LOD high-res pan/zoom rebuild', {
        uids: uids.length,
        attemptKey,
        zoom: viewStateRef.current.zoom,
      })
      for (const uid of uids) {
        runBulkViewportRebuildForGroup(uid, { quiet: true, force: true })
      }
    }, 160)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    loadBulkAnnotations,
    baseLayerReady,
    visibleBulkAnnotationGroupUIDs,
    runBulkViewportRebuildForGroup,
    viewState.zoom,
    viewState.target,
    isBulkHighRes,
  ])

  const bulkHighRes = useMemo(() => {
    const geom = bulkGeometryRef.current
    if (geom == null) {
      return false
    }
    return isBulkHighRes(viewState.zoom, geom.pyramid)
  }, [viewState.zoom, isBulkHighRes])

  const streamingOverlayUidSet = useMemo(
    () => new Set(Object.keys(streamingDeckOverlaysByUid)),
    [streamingDeckOverlaysByUid],
  )

  // bulkSlicesByUid / bulkStreamPaintGen invalidate while data is read via refs.
  const annLayers = useMemo((): Layer[] => {
    void bulkSlicesByUid
    void bulkStreamPaintGen
    const geom = bulkGeometryRef.current
    const sr = slideRef.current
    const radiusContext: BulkScatterRadiusContext | null =
      sr != null
        ? {
            pixelSpacingMm:
              geom != null
                ? readFinestPyramidPixelSpacingMm(geom.pyramid)
                : null,
            viewportWidth: size.width,
            viewportHeight: size.height,
            slideWidth: sr.worldW,
            slideHeight: sr.worldH,
          }
        : null
    const styled = buildStyledBulkOverlayLayers(
      slicesByUidRef.current,
      visibleBulkAnnotationGroupUIDs,
      bulkAnnotationGroupStyles,
      bulkDefaultStyles,
      slideMatrixRef.current,
      styledOverlayCacheRef.current,
      viewState.zoom,
      () => viewStateRef.current.zoom,
      radiusContext,
      bulkHighRes,
      streamingOverlayUidSet,
    )
    const streaming = Object.values(streamingDeckOverlaysByUid).flat()
    if (vivBulkAnnVerboseProgress() && streaming.length > 0) {
      vivBulkAnnDebug('deck:streaming overlay layers', {
        streamingLayerCount: streaming.length,
        streamingGroups: streamingOverlayUidSet.size,
        styledLayerCount: styled.length,
      })
    }
    return [...streaming, ...styled]
  }, [
    bulkSlicesByUid,
    visibleBulkAnnotationGroupUIDs,
    bulkAnnotationGroupStyles,
    bulkDefaultStyles,
    viewState.zoom,
    size.width,
    size.height,
    bulkHighRes,
    bulkStreamPaintGen,
    streamingDeckOverlaysByUid,
    streamingOverlayUidSet,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw when annLayers identity changes
  useLayoutEffect(() => {
    if (!loadBulkAnnotations) {
      return
    }
    deckRef.current?.deck?.redraw('bulk-stream-overlay')
  }, [annLayers, loadBulkAnnotations, streamingDeckOverlaysByUid])

  const handleBulkDeckHover = useCallback((info: PickingInfo) => {
    if (info.layer == null || info.x == null || info.y == null) {
      setBulkHoverTooltip(null)
      return
    }
    const uid = bulkGroupUidFromDeckLayerId(String(info.layer.id))
    if (uid == null) {
      setBulkHoverTooltip(null)
      return
    }
    const metadata = bulkMetadataByUidRef.current[uid]
    if (metadata == null) {
      setBulkHoverTooltip(null)
      return
    }
    const attributes = vivBulkAnnotationHoverAttributes(uid, metadata)
    if (attributes.length === 0) {
      setBulkHoverTooltip(null)
      return
    }
    setBulkHoverTooltip({
      x: info.x,
      y: info.y,
      rois: [
        {
          index: 1,
          roiUid: uid,
          attributes,
        },
      ],
    })
  }, [])
  const orthoZoomClamp = useMemo(() => {
    const slide = slideRef.current
    if (slide != null && !loading) {
      return orthographicZoomLimits(
        size.width,
        size.height,
        slide.worldW,
        slide.worldH,
        slide.levelCount,
      )
    }
    return {
      minZoom: Number.NEGATIVE_INFINITY,
      maxZoom: Number.POSITIVE_INFINITY,
    }
  }, [loading, size.width, size.height])

  const imageLayers = useMemo((): Layer[] => {
    if (baseLayer == null) {
      return []
    }
    if (!bulkHydrateTileThrottle) {
      return [baseLayer]
    }
    // Deck clone only adjusts concurrency; same loader / cache / selections.
    // maxRequests is a TileLayer/Viv prop, not on deck.gl's base LayerProps types.
    return [
      baseLayer.clone({
        maxRequests: 4,
      } as never) as Layer,
    ]
  }, [baseLayer, bulkHydrateTileThrottle])

  const sharedViewState = useMemo(
    () => ({
      ...viewState,
      ...orthoZoomClamp,
    }),
    [viewState, orthoZoomClamp],
  )

  const handleViewStateChange = useCallback(
    ({
      viewState: vs,
    }: {
      viewState:
        | {
            zoom?: number
            target?: [number, number] | [number, number, number]
          }
        | Record<string, unknown>
    }) => {
      if (
        vs == null ||
        typeof vs !== 'object' ||
        !('zoom' in vs) ||
        !('target' in vs)
      ) {
        return
      }
      const sr = slideRef.current
      if (sr == null) {
        return
      }
      const { width: cw, height: ch } = sizeRef.current
      const lim = orthographicZoomLimits(
        cw,
        ch,
        sr.worldW,
        sr.worldH,
        sr.levelCount,
      )
      const rawZ = vs.zoom as number
      const zClamped = Math.min(lim.maxZoom, Math.max(lim.minZoom, rawZ))
      const zq = Number(zClamped.toFixed(5))
      const t = vs.target as [number, number] | [number, number, number]
      setViewState({
        target: [t[0], t[1], t[2] ?? 0],
        zoom: zq,
      })
    },
    [],
  )

  return (
    <div
      style={{
        flex: '1 1 0%',
        alignSelf: 'stretch',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {loading ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            zIndex: 2,
            background: 'rgba(255,255,255,0.6)',
          }}
        >
          <Spin size="large" tip="Loading viv..." />
        </div>
      ) : null}
      {!loading && loadBulkAnnotations ? (
        <VivBulkAnnotationLoadIndicator
          status={bulkLoadStatus}
          variant="overlay"
        />
      ) : null}
      <div ref={slotRef} style={{ position: 'absolute', inset: 0 }}>
        <DeckGL
          ref={imageDeckRef}
          views={orthographicView}
          viewState={sharedViewState}
          onViewStateChange={handleViewStateChange}
          controller={{ inertia: false }}
          layers={imageLayers}
          width={size.width}
          height={size.height}
          getCursor={() => 'grab'}
        />
        {loadBulkAnnotations ? (
          <DeckGL
            ref={deckRef}
            style={{
              position: 'absolute',
              left: '0',
              top: '0',
              width: '100%',
              height: '100%',
              // When layers exist this canvas sits above the image Deck and must
              // own pan/zoom (controller below) — controller={false} left wheel
              // events eaten with nowhere to go.
              pointerEvents: annLayers.length > 0 ? 'auto' : 'none',
            }}
            views={orthographicView}
            viewState={sharedViewState}
            onViewStateChange={handleViewStateChange}
            controller={annLayers.length > 0 ? { inertia: false } : false}
            layers={annLayers}
            width={size.width}
            height={size.height}
            getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
            onHover={handleBulkDeckHover}
          />
        ) : null}
      </div>
      {bulkHoverTooltip != null ? (
        <HoveredRoiTooltip
          xPosition={bulkHoverTooltip.x}
          yPosition={bulkHoverTooltip.y}
          rois={bulkHoverTooltip.rois}
        />
      ) : null}
    </div>
  )
}

export default VivSlideViewport

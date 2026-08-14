import type { Layer } from '@deck.gl/core'
import { type PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { DeckGLRef } from '@deck.gl/react'
import type { Matrix4 } from '@math.gl/core'
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

import type DicomWebManager from '../DicomWebManager'
import {
  getVivBulkLodEnabled,
  getVivBulkLodLevelsFromFinest,
  resolveVivBulkLodLevelsFromFinest,
  subscribeVivBulkLodPreference,
} from '../preferences/vivBulkLodPreference'
import { logger } from '../utils/logger'
import { terminateCenterOutAnnotationOrderWorker } from './centerOutAnnotationOrder'
import type { BulkAnnotationGeometryContext, DicomLoader } from './dicomLoader'
import {
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
  computeVivBulkCentroidRadiusPixels,
  computeVivBulkPathStrokeWidthPixels,
  VIV_BULK_DEFAULT_OVERLAY_COLOR,
  VIV_BULK_PATH_STROKE_MAX_PX,
  VIV_BULK_PATH_STROKE_MIN_PX,
} from './vivDisplayDefaults'

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
        /**
         * Constant-valued accessors: pass plain numbers/arrays instead of
         * functions so deck.gl uses constant attributes (no per-instance
         * attribute fill on zoom). Zoom changes produce a new clone via the
         * cache above, and updating a constant prop value is cheap.
         */
        const radiusPx = computeVivBulkCentroidRadiusPixels({
          deckZoom,
          pixelSpacingMm: radiusContext?.pixelSpacingMm ?? null,
          lodOverview,
          viewportWidth: radiusContext?.viewportWidth,
          viewportHeight: radiusContext?.viewportHeight,
          slideWidth: radiusContext?.slideWidth,
          slideHeight: radiusContext?.slideHeight,
        })
        const styled = (layer as ScatterplotLayer).clone({
          pickable: true,
          getFillColor: rgba,
          getRadius: radiusPx,
          radiusMinPixels: 1,
          updateTriggers: {
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
 * Growing centroid coordinate buffer per group while bulk bytes stream in.
 * Flat interleaved XY in a typed array (amortized doubling) so each stream
 * commit uploads binary data instead of copying a JS tuple array.
 */
type StreamingCentroidAcc = {
  coords: Float32Array
  /** Number of points written (coords holds `count * 2` floats). */
  count: number
}

function appendCentroidsToAcc(
  acc: StreamingCentroidAcc,
  points: Array<[number, number]>,
): void {
  const needed = (acc.count + points.length) * 2
  if (needed > acc.coords.length) {
    let capacity = Math.max(acc.coords.length, 2048)
    while (capacity < needed) {
      capacity *= 2
    }
    const grown = new Float32Array(capacity)
    grown.set(acc.coords.subarray(0, acc.count * 2))
    acc.coords = grown
  }
  const base = acc.count * 2
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    if (point != null) {
      acc.coords[base + i * 2] = point[0]
      acc.coords[base + i * 2 + 1] = point[1]
    }
  }
  acc.count += points.length
}

export type VivViewState = {
  target: [number, number, number]
  zoom: number
}

export interface UseVivBulkAnnotationsOptions {
  /** `loadBulkAnnotations` prop — when false the hook clears and idles. */
  enabled: boolean
  /** True once the multiscale image layer for the current series is built. */
  baseLayerReady: boolean
  /** SM / tile store client; bulk byte fetches use this. */
  client: DicomWebManager
  /** ANN series QIDO/metadata client. Defaults to `client`. */
  bulkAnnotationClient?: DicomWebManager
  studyInstanceUID: string
  seriesInstanceUID: string
  /** Which bulk annotation groups are drawn (classic viewer parity). */
  visibleGroupUIDs: Set<string>
  /** Per-group opacity/color overrides from the panel. */
  groupStyles: Record<string, { opacity: number; color: number[] }>
  onCatalogChange?: (catalog: VivBulkAnnotationCatalogPayload | null) => void
  onLoadStatusChange?: (status: VivBulkAnnotationLoadStatus) => void
  /** Same loader instance that built the base layer (geometry + ANN bulk fetches only). */
  dicomLoaderRef: { current: DicomLoader | null }
  slideRef: {
    current: { worldW: number; worldH: number; levelCount: number } | null
  }
  /** Same transform as the multiscale image (bulk overlays stay aligned). */
  slideMatrixRef: { current: Matrix4 | null }
  viewState: VivViewState
  viewStateRef: { current: VivViewState }
  size: { width: number; height: number }
  sizeRef: { current: { width: number; height: number } }
  /** Annotation overlay Deck instance (progressive stream repaints). */
  annotationDeckRef: { current: DeckGLRef | null }
}

export interface UseVivBulkAnnotationsResult {
  /** Styled bulk overlay layers (streaming previews first) for the annotation Deck. */
  annLayers: Layer[]
  bulkLoadStatus: VivBulkAnnotationLoadStatus
  /**
   * True while one or more bulk annotation groups are hydrating — further throttle
   * Viv tile concurrency so graphicIndex / Range bulkdata share the proxy budget.
   */
  bulkHydrateTileThrottle: boolean
  /** ANN metadata per group UID (hover tooltip lookups). */
  bulkMetadataByUidRef: {
    current: VivBulkAnnotationCatalogPayload['metadataByGroupUID']
  }
}

/**
 * Owns bulk simple-annotation orchestration for {@link VivSlideViewport}:
 * catalog/geometry loading, per-group hydrate dispatch + cancellation
 * generations, streaming overlay state, LOD viewport rebuilds, load-status
 * reporting, and styled deck layer building. The component keeps rendering
 * concerns (view state, sizing, Deck instances) and passes them in.
 */
export function useVivBulkAnnotations(
  options: UseVivBulkAnnotationsOptions,
): UseVivBulkAnnotationsResult {
  const {
    enabled,
    baseLayerReady,
    client,
    bulkAnnotationClient,
    studyInstanceUID,
    seriesInstanceUID,
    visibleGroupUIDs,
    groupStyles,
    onCatalogChange,
    onLoadStatusChange,
    dicomLoaderRef,
    slideRef,
    slideMatrixRef,
    viewState,
    viewStateRef,
    size,
    sizeRef,
    annotationDeckRef,
  } = options

  const catalogCbRef = useRef(onCatalogChange)
  catalogCbRef.current = onCatalogChange
  const bulkMetadataByUidRef = useRef<
    VivBulkAnnotationCatalogPayload['metadataByGroupUID']
  >({})

  const loadStatusCbRef = useRef(onLoadStatusChange)
  loadStatusCbRef.current = onLoadStatusChange

  const bulkLoadStatusRef = useRef(EMPTY_VIV_BULK_LOAD_STATUS)
  const groupDoneTimersRef = useRef<Record<string, number>>({})
  const groupLoadStartedRef = useRef<Record<string, number>>({})

  const [bulkLoadStatus, setBulkLoadStatus] = useState(
    EMPTY_VIV_BULK_LOAD_STATUS,
  )

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

  /**
   * Failed hydrate / rebuild: surface the `error` phase (spinner must not run
   * forever) and settle the group's load state after a few seconds. The group
   * stays re-hydratable — toggling it off and on dispatches a fresh hydrate.
   */
  const markGroupLoadError = useCallback(
    (groupUID: string, detail?: string) => {
      const startedAtMs = groupLoadStartedRef.current[groupUID] ?? Date.now()
      patchBulkLoadStatus((prev) =>
        upsertVivBulkGroupLoadState(prev, groupUID, {
          phase: 'error',
          startedAtMs,
          finishedAtMs: Date.now(),
          ...(detail != null ? { detail } : {}),
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
      }, 6000)
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
      /** A fresh progress report supersedes any pending done/error auto-clear. */
      if (groupDoneTimersRef.current[groupUID] != null) {
        window.clearTimeout(groupDoneTimersRef.current[groupUID])
        delete groupDoneTimersRef.current[groupUID]
      }
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

  const bulkGeometryRef = useRef<BulkAnnotationGeometryContext | null>(null)
  const bulkGroupJobsRef = useRef<Record<string, VivBulkGroupGeometryJob>>({})
  /**
   * In-flight hydrate ownership: uid → dispatch generation. Settle paths only
   * clear shared state when they still own the entry — a stale hydrate that
   * settles after a fast hide→show must not wipe the re-dispatched hydrate.
   */
  const bulkHydrateInFlightRef = useRef<Map<string, number>>(new Map())
  /**
   * Hydrate cancellation generation per group UID. Bumping only the UIDs that
   * actually became invisible (or a full bump on series/catalog change) means
   * toggling group B cannot cancel group A's in-flight download.
   */
  const hydrateGenByUidRef = useRef<Map<string, number>>(new Map())
  /** Overlapping hydrate batches: throttle tiles until the last one settles. */
  const hydrateBatchActiveRef = useRef(0)
  /**
   * Bumped on series/catalog reset so a late `allSettled` from an old batch
   * cannot decrement the throttle counter of a newer series' hydrates.
   */
  const hydrateBatchEpochRef = useRef(0)
  const bulkViewportRebuildGenRef = useRef<Record<string, number>>({})
  /** Raw bulk buffers (~tens–100s MB); kept out of React state so path layers can be released independently. */
  const bulkGraphicCacheByUidRef = useRef<Record<string, VivBulkGraphicCache>>(
    {},
  )
  const visibleBulkUidsRef = useRef(visibleGroupUIDs)
  visibleBulkUidsRef.current = visibleGroupUIDs
  const slicesByUidRef = useRef<Record<string, VivBulkAnnotationLayerSlice>>({})
  const styledOverlayCacheRef = useRef(new Map<string, StyledLayerCacheEntry>())
  /**
   * Growing centroid buffer per group while bulk bytes stream in. Merged into
   * one ScatterplotLayer so Deck can paint progressively instead of waiting
   * for dozens of separate GPU uploads to finish.
   */
  const streamingCentroidAccRef = useRef(
    new Map<string, StreamingCentroidAcc>(),
  )
  /** Tracks centers ↔ paths LOD; rebuild geometry only when this flips, not on every zoom step. */
  const bulkLodHighResRef = useRef<boolean | null>(null)
  /**
   * Last full-path rebuild attempt key per group (`zoomBucket:tx:ty`) so a failed
   * / empty path rebuild can retry after pan/zoom without looping forever.
   */
  const bulkFullPathAttemptKeyRef = useRef<Record<string, string>>({})

  const [bulkSlicesByUid, setBulkSlicesByUid] = useState<
    Record<string, VivBulkAnnotationLayerSlice>
  >({})
  /** Bumped on each streaming centroid paint so Deck always sees a new layers prop. */
  const [bulkStreamPaintGen, setBulkStreamPaintGen] = useState(0)
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
  /**
   * Mirrors `bulkGeometryRef` / `bulkGroupJobsRef` readiness into state so the
   * hydrate effect and zoom-dependent memos re-run once the async catalog load
   * lands (refs alone do not re-trigger React).
   */
  const [bulkCatalogReady, setBulkCatalogReady] = useState(false)
  /**
   * Bumped when a gen-mismatch cleanup dropped a still-visible group's partial
   * slice, so the hydrate effect re-runs and re-dispatches that group.
   */
  const [hydrateRetryNonce, setHydrateRetryNonce] = useState(0)

  const groupStylesRef = useRef(groupStyles)
  groupStylesRef.current = groupStyles
  const bulkDefaultStylesRef = useRef(bulkDefaultStyles)
  bulkDefaultStylesRef.current = bulkDefaultStyles

  /**
   * Single commit point for slice state: sync the ref and set state outside of
   * any updater function (React Strict Mode double-invokes updaters, so state
   * updaters must stay pure).
   */
  const commitSlices = useCallback(
    (next: Record<string, VivBulkAnnotationLayerSlice>): void => {
      slicesByUidRef.current = next
      setBulkSlicesByUid(next)
    },
    [],
  )

  const bumpHydrateGen = useCallback((uid: string): void => {
    const gens = hydrateGenByUidRef.current
    gens.set(uid, (gens.get(uid) ?? 0) + 1)
  }, [])

  /** Series/catalog change: every in-flight hydrate is stale. */
  const bumpAllHydrateGens = useCallback((): void => {
    const gens = hydrateGenByUidRef.current
    for (const [uid, gen] of gens) {
      gens.set(uid, gen + 1)
    }
  }, [])

  /**
   * Drop the in-flight marker only when `hydrateGen` still owns this uid.
   * Returns true when this settle path may safely mutate shared stream state.
   */
  const releaseHydrateIfOwner = useCallback(
    (uid: string, hydrateGen: number): boolean => {
      const inFlight = bulkHydrateInFlightRef.current
      if (inFlight.get(uid) !== hydrateGen) {
        return false
      }
      inFlight.delete(uid)
      return true
    },
    [],
  )

  /** Drop a group's partial streaming artifacts (acc, overlay, slice layers). */
  const clearGroupStreamArtifacts = useCallback(
    (uid: string): void => {
      streamingCentroidAccRef.current.delete(uid)
      setStreamingDeckOverlaysByUid((prev) => {
        if (prev[uid] == null) {
          return prev
        }
        const next = { ...prev }
        delete next[uid]
        return next
      })
      const current = slicesByUidRef.current
      const slice = current[uid]
      if (slice != null) {
        if (slice.layers.length > 0) {
          detachVivBulkOverlayLayerData(slice.layers)
        }
        const next = { ...current }
        delete next[uid]
        commitSlices(next)
      }
      styledOverlayCacheRef.current.delete(uid)
    },
    [commitSlices],
  )

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
        commitSlices({
          ...slicesByUidRef.current,
          [uid]: cleared,
        })
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
      /** Next slice is computed outside setState so updaters stay pure. */
      let swappedPriorLayers = false
      const appendChunkToSlice = (chunkLayers: Layer[]): void => {
        /**
         * Skip empty chunks while still holding the prior LOD overlay. The first
         * non-empty chunk replaces prior layers; later chunks append.
         */
        const existing = slicesByUidRef.current[uid]
        if (!swappedPriorLayers) {
          if (chunkLayers.length === 0) {
            return
          }
          swappedPriorLayers = true
          const nextSlice: VivBulkAnnotationLayerSlice = {
            groupUID: uid,
            graphicType: existing?.graphicType ?? cache.graphicType,
            supportsLod: existing?.supportsLod ?? true,
            layers: [...chunkLayers],
          }
          commitSlices({
            ...slicesByUidRef.current,
            [uid]: nextSlice,
          })
          return
        }
        const nextSlice: VivBulkAnnotationLayerSlice = {
          groupUID: uid,
          graphicType: existing?.graphicType ?? cache.graphicType,
          supportsLod: existing?.supportsLod ?? true,
          layers: [...(existing?.layers ?? []), ...chunkLayers],
        }
        commitSlices({
          ...slicesByUidRef.current,
          [uid]: nextSlice,
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
            /**
             * No streamed chunks: swap the full result in atomically — but never
             * replace an existing centroid overview with an empty path result
             * (that left high-zoom views with neither centroids nor polygons).
             */
            const existing = slicesByUidRef.current[uid]
            if (layers.length === 0 && (existing?.layers.length ?? 0) > 0) {
              vivBulkAnnDebug(
                'viewport:LOD keep prior layers (empty full rebuild)',
                { uid, mode, priorLayers: existing?.layers.length ?? 0 },
              )
              /** Allow the next pan/zoom attempt key to retry this region. */
              delete bulkFullPathAttemptKeyRef.current[uid]
            } else {
              const nextSlice: VivBulkAnnotationLayerSlice = {
                groupUID: uid,
                graphicType: existing?.graphicType ?? cache.graphicType,
                supportsLod: existing?.supportsLod ?? true,
                layers,
              }
              commitSlices({
                ...slicesByUidRef.current,
                [uid]: nextSlice,
              })
            }
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
          if (bulkViewportRebuildGenRef.current[uid] !== gen) {
            return
          }
          /**
           * A non-quiet rebuild reported 'processing' — settle it as an error
           * so the load indicator cannot spin forever.
           */
          if (!quiet && visibleBulkUidsRef.current.has(uid)) {
            markGroupLoadError(uid)
          }
        })
    },
    [
      markGroupLoadDone,
      markGroupLoadError,
      reportGroupLoad,
      isBulkHighRes,
      commitSlices,
      slideRef,
      sizeRef,
      viewStateRef,
    ],
  )
  const runBulkViewportRebuildForGroupRef = useRef(
    runBulkViewportRebuildForGroup,
  )
  runBulkViewportRebuildForGroupRef.current = runBulkViewportRebuildForGroup

  /**
   * Reset all bulk state on mount and whenever the slide/series changes.
   * Dependencies: client, studyInstanceUID, seriesInstanceUID trigger re-runs.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on slide identity change
  useEffect(() => {
    bulkGeometryRef.current = null
    bulkGroupJobsRef.current = {}
    bulkGraphicCacheByUidRef.current = {}
    bulkViewportRebuildGenRef.current = {}
    bulkFullPathAttemptKeyRef.current = {}
    streamingCentroidAccRef.current.clear()
    bumpAllHydrateGens()
    bulkHydrateInFlightRef.current.clear()
    hydrateBatchEpochRef.current += 1
    hydrateBatchActiveRef.current = 0
    bulkLodHighResRef.current = null
    styledOverlayCacheRef.current.clear()
    bulkMetadataByUidRef.current = {}
    setBulkCatalogReady(false)
    commitSlices({})
    setStreamingDeckOverlaysByUid({})
    setBulkDefaultStyles({})
    setBulkHydrateTileThrottle(false)
    catalogCbRef.current?.(null)
    clearBulkLoadStatus()
    const bulkHydrateInFlight = bulkHydrateInFlightRef.current
    return () => {
      bumpAllHydrateGens()
      bulkHydrateInFlight.clear()
      hydrateBatchEpochRef.current += 1
      hydrateBatchActiveRef.current = 0
      bulkViewportRebuildGenRef.current = {}
      bulkLodHighResRef.current = null
      terminateCenterOutAnnotationOrderWorker()
      clearBulkLoadStatus()
    }
  }, [
    client,
    studyInstanceUID,
    seriesInstanceUID,
    bumpAllHydrateGens,
    clearBulkLoadStatus,
    commitSlices,
  ])

  useEffect(() => {
    if (!enabled) {
      commitSlices({})
      setBulkDefaultStyles({})
      bulkGeometryRef.current = null
      bulkGroupJobsRef.current = {}
      bulkGraphicCacheByUidRef.current = {}
      bumpAllHydrateGens()
      bulkHydrateInFlightRef.current.clear()
      bulkLodHighResRef.current = null
      setBulkCatalogReady(false)
      catalogCbRef.current?.(null)
      clearBulkLoadStatus()
      return
    }
    if (!baseLayerReady) {
      commitSlices({})
      setBulkDefaultStyles({})
      setBulkCatalogReady(false)
      return
    }
    const dicomLoader = dicomLoaderRef.current
    if (dicomLoader === null) {
      logger.warn(
        'viewport: no DicomLoader ref — wait for slide to finish loading',
      )
      return
    }

    /**
     * Invalidate prior catalog immediately so a mid-session client/series
     * change cannot leave visible groups blank against a stale graphic cache.
     */
    bulkGraphicCacheByUidRef.current = {}
    setBulkCatalogReady(false)
    commitSlices({})

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
          commitSlices({})
          setBulkDefaultStyles(loaded.defaultStylesByGroupUID)
          bulkMetadataByUidRef.current = catalog.metadataByGroupUID
          catalogCbRef.current?.(catalog)
          /** Refs are populated — let the hydrate effect / LOD memos re-run. */
          setBulkCatalogReady(true)
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
          commitSlices({})
          setBulkDefaultStyles({})
          setBulkCatalogReady(false)
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
    const bulkHydrateInFlight = bulkHydrateInFlightRef.current
    return () => {
      cancelled = true
      /**
       * Mirror series/hide invalidation: bump gens *and* drop ownership so a
       * stale hydrate settle cannot pass {@link releaseHydrateIfOwner} and
       * reinstall `graphicCache` after this effect already cleared it.
       */
      bumpAllHydrateGens()
      bulkHydrateInFlight.clear()
      hydrateBatchEpochRef.current += 1
      hydrateBatchActiveRef.current = 0
    }
  }, [
    enabled,
    baseLayerReady,
    bulkAnnotationClient,
    client,
    studyInstanceUID,
    seriesInstanceUID,
    patchBulkLoadStatus,
    clearBulkLoadStatus,
    bumpAllHydrateGens,
    commitSlices,
    dicomLoaderRef,
  ])

  const paintBulkDeckLayersNow = useCallback((): void => {
    const deck = annotationDeckRef.current?.deck
    if (deck == null) {
      return
    }
    deck.redraw('bulk-stream-chunk')
  }, [annotationDeckRef])

  /** Yield a macrotask + frame so Deck can composite before the next decode batch. */
  const yieldForStreamPaint = useCallback(async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    /**
     * requestAnimationFrame never fires in hidden tabs — hydrate would stall
     * indefinitely in the background. Fall back to a short timeout there.
     */
    if (document.visibilityState === 'hidden') {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 16)
      })
      return
    }
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = (): void => {
        if (!settled) {
          settled = true
          resolve()
        }
      }
      /** Tab may hide between the visibility check above and the rAF callbacks. */
      const fallback = window.setTimeout(finish, 250)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.clearTimeout(fallback)
          finish()
        })
      })
    })
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: hydrateRetryNonce triggers re-dispatch on gen-mismatch cleanup
  useEffect(() => {
    if (!enabled || !baseLayerReady || !bulkCatalogReady) {
      return
    }
    const geom = bulkGeometryRef.current
    const jobs = bulkGroupJobsRef.current
    if (geom == null || Object.keys(jobs).length === 0) {
      return
    }

    const hydrateInFlight = bulkHydrateInFlightRef.current
    const dispatchedUids: string[] = []
    const tBatch0 = vivBulkAnnNow()
    const batchPromises: Promise<void>[] = []
    const batchEpoch = hydrateBatchEpochRef.current
    for (const uid of visibleGroupUIDs) {
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
      const hydrateGen = hydrateGenByUidRef.current.get(uid) ?? 0
      hydrateGenByUidRef.current.set(uid, hydrateGen)
      hydrateInFlight.set(uid, hydrateGen)
      /** True while this dispatch is still the group's live hydrate. */
      const hydrateGenCurrent = (): boolean =>
        (hydrateGenByUidRef.current.get(uid) ?? 0) === hydrateGen
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
        const commitStreamSlice = async (
          nextSlice: VivBulkAnnotationLayerSlice,
        ): Promise<void> => {
          streamPaintSerial += 1
          const apply = (): void => {
            commitSlices({ ...slicesByUidRef.current, [uid]: nextSlice })
            setBulkStreamPaintGen((g) => g + 1)
          }
          /**
           * First paint + every 8th: force a frame. Other updates stay async so
           * wheel/pan on the overlay controller can run between decode batches.
           */
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
            acc = { coords: new Float32Array(2048), count: 0 }
            streamingCentroidAccRef.current.set(uid, acc)
          }
          for (const layer of centroidChunks) {
            const data = (layer as ScatterplotLayer<[number, number]>).props
              .data as Array<[number, number]>
            appendCentroidsToAcc(acc, data)
          }

          const st = groupStylesRef.current[uid] ??
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
          const pointCount = acc.count
          /**
           * Stable layer id + binary attribute data: deck.gl diffs the existing
           * layer and uploads the typed-array positions directly instead of
           * tearing the layer down and iterating a growing tuple array on every
           * stream commit (previously O(n²) copying via `acc.slice()`).
           */
          const deckLayer = new ScatterplotLayer({
            id: `viv-bulk-${uid}-centers`,
            data: {
              length: pointCount,
              attributes: {
                getPosition: {
                  value: acc.coords.subarray(0, pointCount * 2),
                  size: 2,
                },
              },
            },
            pickable: true,
            getFillColor: rgba,
            getRadius: radiusPx,
            radiusMinPixels: 1,
            radiusUnits: 'pixels',
            ...(matrix != null ? { modelMatrix: matrix } : {}),
          }) as unknown as Layer

          styledOverlayCacheRef.current.delete(uid)
          setStreamingDeckOverlaysByUid((prev) => ({
            ...prev,
            [uid]: [deckLayer],
          }))
          await commitStreamSlice({
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
        /**
         * Path chunks (high-res LOD upgrade): drop centroid stream overlay and
         * replace — never append polygons onto a streamPreview centers layer.
         */
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
          await commitStreamSlice({
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
        await commitStreamSlice({
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
            if (!hydrateGenCurrent() || !visibleBulkUidsRef.current.has(uid)) {
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
            hydrateGenCurrent() && visibleBulkUidsRef.current.has(uid),
          /**
           * Progressive rendering: hydrate calls back as soon as a chunk is
           * decoded — full path/point chunks for smaller groups, or lightweight
           * centroid markers for large LOD groups streamed as bytes arrive — so
           * the user sees partial coverage while the rest of the transfer +
           * decode is still running. For LOD groups these preview layers are
           * replaced by the viewport rebuild once the full buffer is cached.
           */
          onChunk: async (chunkLayers, meta) => {
            if (!hydrateGenCurrent() || !visibleBulkUidsRef.current.has(uid)) {
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
        })
          .then((slice) => {
            if (!hydrateGenCurrent()) {
              /**
               * Gen bump aborted this hydrate. Only mutate shared stream state
               * when this dispatch still owns the in-flight slot — otherwise a
               * re-dispatched hydrate (fast hide→show) would be wiped / duplicated.
               */
              if (!releaseHydrateIfOwner(uid, hydrateGen)) {
                return
              }
              /**
               * If decode still finished with a graphicCache, keep it so we do
               * not drop overlays and force a full re-download — then rebuild
               * for the current LOD.
               */
              if (
                slice?.graphicCache != null &&
                visibleBulkUidsRef.current.has(uid)
              ) {
                bulkGraphicCacheByUidRef.current[uid] = slice.graphicCache
                commitSlices({
                  ...slicesByUidRef.current,
                  [uid]: {
                    groupUID: uid,
                    graphicType: job.graphicType,
                    supportsLod: true,
                    streamPreview: false,
                    layers: slicesByUidRef.current[uid]?.layers ?? [],
                  },
                })
                runBulkViewportRebuildForGroupRef.current(uid, {
                  quiet: true,
                  force: true,
                })
                markGroupLoadDone(uid)
                return
              }
              if (bulkGraphicCacheByUidRef.current[uid] == null) {
                clearGroupStreamArtifacts(uid)
                if (visibleBulkUidsRef.current.has(uid)) {
                  /**
                   * The group is still visible but its partial slice was just
                   * dropped — force the hydrate effect to re-run so it is
                   * re-dispatched instead of staying blank.
                   */
                  setHydrateRetryNonce((n) => n + 1)
                }
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
                committedLayers:
                  slicesByUidRef.current[uid]?.layers.length ?? 0,
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
            if (slice == null) {
              /**
               * Hydrate resolves null on fetch/index failures (and unsupported
               * graphic types). Report the error phase — otherwise the load
               * indicator spins forever — and drop partial streamed layers so
               * toggling the group off and on re-dispatches a fresh hydrate.
               */
              if (!releaseHydrateIfOwner(uid, hydrateGen)) {
                return
              }
              clearGroupStreamArtifacts(uid)
              if (visibleBulkUidsRef.current.has(uid)) {
                markGroupLoadError(uid)
              } else {
                patchBulkLoadStatus((prev) =>
                  removeVivBulkGroupLoadState(prev, uid),
                )
                delete groupLoadStartedRef.current[uid]
              }
              return
            }
            if (visibleBulkUidsRef.current.has(uid)) {
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
                commitSlices({
                  ...slicesByUidRef.current,
                  [uid]: {
                    groupUID: uid,
                    graphicType: job.graphicType,
                    supportsLod: true,
                    streamPreview: false,
                    layers: slicesByUidRef.current[uid]?.layers ?? [],
                  },
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
                  runBulkViewportRebuildForGroupRef.current(uid, {
                    force: true,
                  })
                }
              } else if (chunksCommitted === 0) {
                const committed: VivBulkAnnotationLayerSlice = {
                  groupUID: slice.groupUID,
                  graphicType: slice.graphicType,
                  supportsLod: slice.supportsLod,
                  layers: slice.layers,
                }
                startTransition(() => {
                  commitSlices({
                    ...slicesByUidRef.current,
                    [uid]: committed,
                  })
                })
                markGroupLoadDone(uid)
              } else {
                markGroupLoadDone(uid)
              }
            }
            releaseHydrateIfOwner(uid, hydrateGen)
          })
          .catch((e: unknown) => {
            /**
             * A rejected hydrate must not leave the uid stuck in
             * `hydrateInFlight` (blocking all future re-hydration) or the
             * spinner running forever — but only when this dispatch still owns
             * the slot (a newer hydrate may already be running).
             */
            vivBulkAnnDebug('viewport:HYDRATE failed', {
              uid,
              err: e instanceof Error ? e.message : String(e),
            })
            if (!releaseHydrateIfOwner(uid, hydrateGen)) {
              return
            }
            if (!hydrateGenCurrent()) {
              return
            }
            clearGroupStreamArtifacts(uid)
            if (visibleBulkUidsRef.current.has(uid)) {
              markGroupLoadError(
                uid,
                e instanceof Error ? e.message : undefined,
              )
            } else {
              patchBulkLoadStatus((prev) =>
                removeVivBulkGroupLoadState(prev, uid),
              )
              delete groupLoadStartedRef.current[uid]
            }
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
    hydrateBatchActiveRef.current += 1
    setBulkHydrateTileThrottle(true)
    void Promise.allSettled(batchPromises).then(() => {
      if (hydrateBatchEpochRef.current !== batchEpoch) {
        return
      }
      hydrateBatchActiveRef.current = Math.max(
        0,
        hydrateBatchActiveRef.current - 1,
      )
      if (hydrateBatchActiveRef.current === 0) {
        setBulkHydrateTileThrottle(false)
      }
      vivBulkAnnPhase('viewport:HYDRATE batch done (all visible groups)', {
        dispatched: dispatchedUids.length,
        uids: dispatchedUids,
        batchMs: Math.round((vivBulkAnnNow() - tBatch0) * 10) / 10,
      })
    })
    /**
     * No cleanup: cancellation is per-group. Groups that became invisible are
     * invalidated by the hidden-group effect below; series/catalog changes bump
     * every generation. Bumping a global generation here cancelled unrelated
     * in-flight groups whenever the visible set changed.
     *
     * Intentionally omit `runBulkViewportRebuildForGroup` / LOD preference deps.
     * Threshold edits recreate that callback; putting it here aborted in-flight
     * hydrates and cleared mid-stream overlays so status looked "done" while
     * annotations vanished. Rebuild uses `runBulkViewportRebuildForGroupRef`.
     */
  }, [
    enabled,
    baseLayerReady,
    bulkCatalogReady,
    hydrateRetryNonce,
    visibleGroupUIDs,
    client,
    reportGroupLoad,
    markGroupLoadDone,
    markGroupLoadError,
    releaseHydrateIfOwner,
    clearGroupStreamArtifacts,
    commitSlices,
    patchBulkLoadStatus,
    paintBulkDeckLayersNow,
    yieldForStreamPaint,
    slideRef,
    slideMatrixRef,
    sizeRef,
    viewStateRef,
  ])

  /** Drop bulk buffers, GPU layer data, and slice state when a group is hidden. */
  useEffect(() => {
    const hiddenUids = new Set<string>()
    for (const uid of Object.keys(bulkGraphicCacheByUidRef.current)) {
      if (!visibleGroupUIDs.has(uid)) {
        hiddenUids.add(uid)
      }
    }
    for (const uid of bulkHydrateInFlightRef.current.keys()) {
      if (!visibleGroupUIDs.has(uid)) {
        hiddenUids.add(uid)
      }
    }
    for (const uid of Object.keys(slicesByUidRef.current)) {
      if (!visibleGroupUIDs.has(uid)) {
        hiddenUids.add(uid)
      }
    }
    if (hiddenUids.size === 0) {
      return
    }
    for (const uid of hiddenUids) {
      const slice = slicesByUidRef.current[uid]
      if (slice?.layers.length) {
        detachVivBulkOverlayLayerData(slice.layers)
      }
      delete bulkGraphicCacheByUidRef.current[uid]
      bulkViewportRebuildGenRef.current[uid] =
        (bulkViewportRebuildGenRef.current[uid] ?? 0) + 1
      /**
       * Per-group invalidation: only the groups that actually became invisible
       * lose their hydrate generation, so other groups keep streaming.
       */
      if (bulkHydrateInFlightRef.current.has(uid)) {
        bumpHydrateGen(uid)
        bulkHydrateInFlightRef.current.delete(uid)
      }
      streamingCentroidAccRef.current.delete(uid)
      patchBulkLoadStatus((prev) => removeVivBulkGroupLoadState(prev, uid))
      delete groupLoadStartedRef.current[uid]
      if (groupDoneTimersRef.current[uid] != null) {
        window.clearTimeout(groupDoneTimersRef.current[uid])
        delete groupDoneTimersRef.current[uid]
      }
    }
    /** Layer detach already happened above — updaters below stay pure. */
    const currentSlices = slicesByUidRef.current
    let nextSlices: Record<string, VivBulkAnnotationLayerSlice> | null = null
    for (const uid of hiddenUids) {
      if (currentSlices[uid] != null) {
        if (nextSlices === null) {
          nextSlices = { ...currentSlices }
        }
        delete nextSlices[uid]
      }
    }
    if (nextSlices !== null) {
      commitSlices(nextSlices)
    }
    setStreamingDeckOverlaysByUid((prev) => {
      let next: Record<string, Layer[]> | null = null
      for (const uid of Object.keys(prev)) {
        if (hiddenUids.has(uid)) {
          if (next === null) {
            next = { ...prev }
          }
          delete next[uid]
        }
      }
      return next ?? prev
    })
  }, [visibleGroupUIDs, patchBulkLoadStatus, bumpHydrateGen, commitSlices])

  /** LOD mode flip (centers ↔ paths): rebuild geometry immediately. */
  useEffect(() => {
    if (!enabled || !baseLayerReady || !bulkCatalogReady) {
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
    for (const uid of visibleGroupUIDs) {
      if (bulkGraphicCacheByUidRef.current[uid] == null) {
        continue
      }
      if (highRes) {
        /** Mark this view so the pan/zoom effect does not immediately rebuild again. */
        bulkFullPathAttemptKeyRef.current[uid] = attemptKey
      } else {
        delete bulkFullPathAttemptKeyRef.current[uid]
      }
      runBulkViewportRebuildForGroup(uid, { quiet: true, force: true })
    }
  }, [
    enabled,
    baseLayerReady,
    bulkCatalogReady,
    visibleGroupUIDs,
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
    if (!enabled || !baseLayerReady || !bulkCatalogReady) {
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
      for (const uid of visibleGroupUIDs) {
        if (bulkGraphicCacheByUidRef.current[uid] == null) {
          continue
        }
        /** Same view bucket already rebuilt (or in flight) — skip. */
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
    enabled,
    baseLayerReady,
    bulkCatalogReady,
    visibleGroupUIDs,
    runBulkViewportRebuildForGroup,
    viewState.zoom,
    viewState.target,
    isBulkHighRes,
    viewStateRef,
  ])

  /**
   * `bulkCatalogReady` mirrors the async `bulkGeometryRef` load into state, so
   * this recomputes as soon as geometry is available instead of waiting for the
   * next zoom change.
   */
  const bulkHighRes = useMemo(() => {
    if (!bulkCatalogReady) {
      return false
    }
    const geom = bulkGeometryRef.current
    if (geom == null) {
      return false
    }
    return isBulkHighRes(viewState.zoom, geom.pyramid)
  }, [viewState.zoom, isBulkHighRes, bulkCatalogReady])

  const streamingOverlayUidSet = useMemo(
    () => new Set(Object.keys(streamingDeckOverlaysByUid)),
    [streamingDeckOverlaysByUid],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: bulkSlicesByUid/bulkStreamPaintGen invalidate while data is read via refs
  const annLayers = useMemo((): Layer[] => {
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
      visibleGroupUIDs,
      groupStyles,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bulkSlicesByUid/bulkStreamPaintGen invalidate while data is read via refs
  }, [
    bulkSlicesByUid,
    visibleGroupUIDs,
    groupStyles,
    bulkDefaultStyles,
    viewState.zoom,
    size.width,
    size.height,
    bulkHighRes,
    bulkStreamPaintGen,
    streamingDeckOverlaysByUid,
    streamingOverlayUidSet,
    slideRef,
    slideMatrixRef,
    viewStateRef,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw when annLayers identity changes
  useLayoutEffect(() => {
    if (!enabled) {
      return
    }
    annotationDeckRef.current?.deck?.redraw('bulk-stream-overlay')
  }, [annLayers, annotationDeckRef, enabled, streamingDeckOverlaysByUid])

  return {
    annLayers,
    bulkLoadStatus,
    bulkHydrateTileThrottle,
    bulkMetadataByUidRef,
  }
}

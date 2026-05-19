import type { Layer } from '@deck.gl/core'
import { OrthographicView } from '@deck.gl/core'
import type { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import DeckGL from '@deck.gl/react'
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

import type { VivSettings } from '../AppConfig'
import type DicomWebManager from '../DicomWebManager'
import {
  getIccProfilesEnabled,
  setIccProfilesEnabled,
  subscribeIccProfilesEnabled,
} from '../preferences/iccProfilesPreference'
import { logger } from '../utils/logger'
import { CenterOutTileset2D } from './centerOutTileset'
import {
  type BulkAnnotationGeometryContext,
  DicomLoader,
  isVivDicomTileNetworkCancellation,
} from './dicomLoader'
import {
  computeVivBulkHighResolution,
  deckLoadCenterFromViewTarget,
  deckViewportBoundsFromViewState,
  detachVivBulkOverlayLayerData,
  hydrateVivBulkGroupLayerSlice,
  loadBulkAnnotationMetadataAndJobs,
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
  buildVivDisplayOptions,
  computeOrthographicFitViewState,
  orthographicZoomLimits,
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
  return /-pts(?:-\d+)?$/.test(layerId)
}

/** LOD center markers use `${id}-centers` or chunked `${id}-centers-0`, … */
function isBulkVivCenterLayerId(layerId: string): boolean {
  return /-centers(?:-\d+)?$/.test(layerId)
}

function buildStyledBulkOverlayLayers(
  slicesByUid: Record<string, VivBulkAnnotationLayerSlice>,
  visibleUIDs: Set<string>,
  styles: Record<string, { opacity: number; color: number[] }>,
  defaultStyles: Record<string, { opacity: number; color: number[] }>,
  modelMatrix: Matrix4 | null,
): Layer[] {
  const out: Layer[] = []
  for (const uid of visibleUIDs) {
    const slice = slicesByUid[uid]
    if (slice == null) {
      continue
    }
    const st = styles[uid] ??
      defaultStyles[uid] ?? {
        opacity: 1,
        color: [220, 60, 60],
      }
    const a = Math.round(Math.max(0, Math.min(1, st.opacity)) * 220)
    const rgba: [number, number, number, number] = [
      st.color[0] ?? 0,
      st.color[1] ?? 0,
      st.color[2] ?? 0,
      a,
    ]
    const matrixProps = modelMatrix != null ? { modelMatrix } : {}
    for (const layer of slice.layers) {
      const lid = String(layer.id)
      if (isBulkVivPathLayerId(lid)) {
        out.push(
          (layer as PathLayer).clone({
            getColor: rgba,
            ...matrixProps,
          }),
        )
      } else if (isBulkVivPointLayerId(lid) || isBulkVivCenterLayerId(lid)) {
        out.push(
          (layer as ScatterplotLayer).clone({
            getFillColor: rgba,
            ...matrixProps,
          }),
        )
      } else {
        out.push(
          matrixProps.modelMatrix != null ? layer.clone(matrixProps) : layer,
        )
      }
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
  onIccProfilesAvailabilityChange,
  studyInstanceUID,
  seriesInstanceUID,
  vivSettings,
}) => {
  const catalogCbRef = useRef(onBulkAnnotationCatalogChange)
  catalogCbRef.current = onBulkAnnotationCatalogChange

  const iccAvailCbRef = useRef(onIccProfilesAvailabilityChange)
  iccAvailCbRef.current = onIccProfilesAvailabilityChange

  const iccProfilesEnabled = useSyncExternalStore(
    subscribeIccProfilesEnabled,
    getIccProfilesEnabled,
    getIccProfilesEnabled,
  )
  /** Tracks last-applied ICC value so we only rebuild when the shared preference changes. */
  const iccPropRef = useRef(iccProfilesEnabled)

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
  const bulkViewportRebuildGenRef = useRef<Record<string, number>>({})
  /** Raw bulk buffers (~tens–100s MB); kept out of React state so path layers can be released independently. */
  const bulkGraphicCacheByUidRef = useRef<Record<string, VivBulkGraphicCache>>(
    {},
  )
  const VIV_BULK_VIEWPORT_REBUILD_MS = 400
  const visibleBulkUidsRef = useRef(visibleBulkAnnotationGroupUIDs)
  visibleBulkUidsRef.current = visibleBulkAnnotationGroupUIDs
  const slicesByUidRef = useRef<Record<string, VivBulkAnnotationLayerSlice>>({})

  const [size, setSize] = useState({ width: 100, height: 100 })
  const [baseLayer, setBaseLayer] = useState<Layer | null>(null)
  const [bulkSlicesByUid, setBulkSlicesByUid] = useState<
    Record<string, VivBulkAnnotationLayerSlice>
  >({})
  const [bulkDefaultStyles, setBulkDefaultStyles] = useState<
    Record<string, { opacity: number; color: number[] }>
  >({})
  slicesByUidRef.current = bulkSlicesByUid

  const runBulkViewportRebuildForGroup = useCallback((uid: string) => {
    const cache = bulkGraphicCacheByUidRef.current[uid]
    const geom = bulkGeometryRef.current
    const sr = slideRef.current
    if (cache == null || geom == null || sr == null) {
      return
    }
    const vs = viewStateRef.current
    const { width: vw, height: vh } = sizeRef.current
    const viewportBounds = deckViewportBoundsFromViewState(
      sr.worldW,
      sr.worldH,
      vw,
      vh,
      vs.target,
      vs.zoom,
    )
    const highRes = computeVivBulkHighResolution({
      deckZoom: vs.zoom,
      pyramid: geom.pyramid,
    })
    const mode = highRes ? 'full' : 'centers'

    const prevSlice = slicesByUidRef.current[uid]
    if (prevSlice != null && prevSlice.layers.length > 0) {
      detachVivBulkOverlayLayerData(prevSlice.layers)
    }

    const gen = (bulkViewportRebuildGenRef.current[uid] ?? 0) + 1
    bulkViewportRebuildGenRef.current[uid] = gen

    vivBulkAnnPhase('viewport:LOD viewport rebuild dispatch', {
      uid,
      mode,
      gen,
    })

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
        })
        startTransition(() => {
          setBulkSlicesByUid((prev) => {
            const existing = prev[uid]
            if (existing == null) {
              return prev
            }
            return {
              ...prev,
              [uid]: {
                ...existing,
                layers,
              },
            }
          })
        })
      })
      .catch((e) => {
        vivBulkAnnDebug('viewport:LOD viewport rebuild failed', {
          uid,
          err: e instanceof Error ? e.message : String(e),
        })
      })
  }, [])

  const annLayers = useMemo((): Layer[] => {
    return buildStyledBulkOverlayLayers(
      bulkSlicesByUid,
      visibleBulkAnnotationGroupUIDs,
      bulkAnnotationGroupStyles,
      bulkDefaultStyles,
      slideMatrixRef.current,
    )
  }, [
    bulkSlicesByUid,
    visibleBulkAnnotationGroupUIDs,
    bulkAnnotationGroupStyles,
    bulkDefaultStyles,
  ])
  const layers = useMemo((): Layer[] => {
    const t0 = vivBulkAnnNow()
    const out = baseLayer !== null ? [baseLayer, ...annLayers] : []
    if (vivBulkAnnVerboseProgress() && annLayers.length > 0) {
      vivBulkAnnDebug('deck:layers useMemo', {
        base: baseLayer != null ? 1 : 0,
        overlayLayers: annLayers.length,
        ms: Math.round((vivBulkAnnNow() - t0) * 100) / 100,
      })
    }
    return out
  }, [baseLayer, annLayers])
  const [loading, setLoading] = useState(true)
  const [viewState, setViewState] = useState<ViewState>({
    target: [0, 0, 0],
    zoom: -6,
  })
  const sizeRef = useRef(size)
  sizeRef.current = size
  const viewStateRef = useRef(viewState)
  viewStateRef.current = viewState

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
        vivSettings,
        bitsAllocated,
      )
      const iccOn = getIccProfilesEnabled()
      const layer = new MultiscaleImageLayer({
        id: `slim-viv-multiscale-icc-${iccOn ? 'on' : 'off'}`,
        loader: sources as never,
        modelMatrix: vivHorizontalFlipMatrix(sw),
        selections: d.selections,
        channelsVisible: d.channelsVisible,
        contrastLimits: d.contrastLimits,
        dtype: sources[0].dtype,
        excludeBackground: true,
        // Passed through to deck.gl TileLayer (not in @vivjs/layers types).
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
    [vivSettings],
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
    bulkHydrateInFlightRef.current.clear()
    catalogCbRef.current?.(null)
    dicomLoaderRef.current = null
    // Do not call onIccProfilesAvailabilityChange(false) here — it disabled the Settings
    // switch until metadata loaded (looked "off"). CaseViewer defaults to true until
    // we know this slide cannot use ICC (see getIccProfilesLength + spp).

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

        if (vivSettings?.initialViewState?.zoom != null) {
          const el = slotRef.current
          const vw = el ? Math.max(1, el.clientWidth) : 800
          const vh = el ? Math.max(1, el.clientHeight) : 600
          const lim = orthographicZoomLimits(vw, vh, sw, sh, sourcesLength)
          const z0 = vivSettings.initialViewState.zoom
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
            vivSettings?.initialViewState?.target,
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
            // Match SlideViewer when profiles exist; also allow RGB slides when getICCProfiles()
            // is still empty (hidden OL viewer timing) so the Settings toggle is usable.
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
      dicomLoaderRef.current = null
    }
  }, [
    client,
    studyInstanceUID,
    seriesInstanceUID,
    vivSettings,
    createMultiscaleFromLoader,
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
      catalogCbRef.current?.(null)
      return
    }
    if (baseLayer === null) {
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
          catalogCbRef.current?.(catalog)
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
    }
  }, [
    loadBulkAnnotations,
    baseLayer,
    bulkAnnotationClient,
    client,
    studyInstanceUID,
    seriesInstanceUID,
  ])

  useEffect(() => {
    if (!loadBulkAnnotations || baseLayer === null) {
      return
    }
    const geom = bulkGeometryRef.current
    const jobs = bulkGroupJobsRef.current
    if (geom == null || Object.keys(jobs).length === 0) {
      return
    }

    const dispatchedUids: string[] = []
    const tBatch0 = vivBulkAnnNow()
    const batchPromises: Promise<void>[] = []
    for (const uid of visibleBulkAnnotationGroupUIDs) {
      if (slicesByUidRef.current[uid] != null) {
        continue
      }
      if (bulkHydrateInFlightRef.current.has(uid)) {
        continue
      }
      const job = jobs[uid]
      if (job == null) {
        continue
      }
      bulkHydrateInFlightRef.current.add(uid)
      dispatchedUids.push(uid)
      const tHydr0 = vivBulkAnnNow()
      vivBulkAnnPhase('viewport:HYDRATE dispatch', {
        uid,
        graphicType: job.graphicType,
        numberOfAnnotations: job.numberOfAnnotations,
      })
      let chunksCommitted = 0
      const isLodJob =
        (job.graphicType === 'POLYGON' || job.graphicType === 'POLYLINE') &&
        job.numberOfAnnotations > 1000
      const appendChunkToSlice = (chunkLayers: Layer[]): void => {
        setBulkSlicesByUid((prev) => {
          const existing = prev[uid]
          const layers = existing
            ? [...existing.layers, ...chunkLayers]
            : [...chunkLayers]
          return {
            ...prev,
            [uid]: {
              groupUID: uid,
              graphicType: job.graphicType,
              layers,
            },
          }
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
      batchPromises.push(
        hydrateVivBulkGroupLayerSlice({
          job,
          geometry: geom,
          fetchClient: client,
          deckLoadCenter,
          viewportBounds,
          // Polled at every chunk boundary so hydrate stops decoding the
          // remaining polygons when the user toggles the group off.
          shouldContinue: () => visibleBulkUidsRef.current.has(uid),
          // Progressive rendering: as soon as hydrate finishes decoding a chunk
          // (~65k polygons), it calls back so we can append those layers to the
          // group's slice and let the user see partial coverage while the rest
          // of the decode + transfer is still running.
          onChunk: isLodJob
            ? undefined
            : (chunkLayers, meta) => {
                if (!visibleBulkUidsRef.current.has(uid)) {
                  vivBulkAnnDebug(
                    'viewport: chunk dropped (no longer visible)',
                    {
                      uid,
                      chunkIndex: meta.chunkIndex,
                    },
                  )
                  return
                }
                chunksCommitted++
                const tSet0 = vivBulkAnnNow()
                vivBulkAnnPhase('viewport:HYDRATE chunk commit', {
                  uid,
                  chunkIndex: meta.chunkIndex,
                  estimatedTotalChunks: meta.estimatedTotalChunks,
                  chunkLayers: chunkLayers.length,
                  sinceDispatchMs:
                    Math.round((vivBulkAnnNow() - tHydr0) * 10) / 10,
                })
                startTransition(() => {
                  appendChunkToSlice(chunkLayers)
                })
                vivBulkAnnDebug('viewport: chunk scheduled', {
                  uid,
                  chunkIndex: meta.chunkIndex,
                  scheduleMs: Math.round((vivBulkAnnNow() - tSet0) * 100) / 100,
                })
              },
        }).then((slice) => {
          vivBulkAnnPerf(
            'viewport:promise hydrateVivBulkGroupLayerSlice settled',
            tHydr0,
            {
              uid,
              stillVisible: visibleBulkUidsRef.current.has(uid),
              sliceLayers: slice?.layers.length ?? 0,
              chunksCommitted,
            },
          )
          vivBulkAnnPhase('viewport:HYDRATE settled (single group)', {
            uid,
            graphicType: job.graphicType,
            numberOfAnnotations: job.numberOfAnnotations,
            sliceLayers: slice?.layers.length ?? 0,
            chunksCommitted,
            stillVisible: visibleBulkUidsRef.current.has(uid),
            hydrateMs: Math.round((vivBulkAnnNow() - tHydr0) * 10) / 10,
          })
          if (slice != null && visibleBulkUidsRef.current.has(uid)) {
            if (slice.graphicCache != null) {
              bulkGraphicCacheByUidRef.current[uid] = slice.graphicCache
              startTransition(() => {
                setBulkSlicesByUid((prev) => ({
                  ...prev,
                  [uid]: {
                    groupUID: uid,
                    graphicType: job.graphicType,
                    supportsLod: true,
                    layers: [],
                  },
                }))
              })
              runBulkViewportRebuildForGroup(uid)
            } else {
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
            }
          }
          bulkHydrateInFlightRef.current.delete(uid)
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
    void Promise.allSettled(batchPromises).then(() => {
      vivBulkAnnPhase('viewport:HYDRATE batch done (all visible groups)', {
        dispatched: dispatchedUids.length,
        uids: dispatchedUids,
        batchMs: Math.round((vivBulkAnnNow() - tBatch0) * 10) / 10,
      })
    })
  }, [
    loadBulkAnnotations,
    baseLayer,
    visibleBulkAnnotationGroupUIDs,
    client,
    runBulkViewportRebuildForGroup,
  ])

  /** Drop bulk buffers and cancel decodes when a LOD group is hidden. */
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
    }
    setBulkSlicesByUid((prev) => {
      let next: Record<string, VivBulkAnnotationLayerSlice> | null = null
      for (const uid of Object.keys(prev)) {
        if (
          !visibleBulkAnnotationGroupUIDs.has(uid) &&
          prev[uid]?.supportsLod === true
        ) {
          if (next === null) {
            next = { ...prev }
          }
          delete next[uid]
        }
      }
      return next ?? prev
    })
  }, [visibleBulkAnnotationGroupUIDs])

  /** LOD: viewport-culled layers only; debounced pan/zoom rebuild. */
  useEffect(() => {
    if (!loadBulkAnnotations || baseLayer === null) {
      return
    }
    const panX = viewState.target[0]
    const panY = viewState.target[1]
    const zoom = viewState.zoom
    const vw = size.width
    const vh = size.height
    const timer = window.setTimeout(() => {
      vivBulkAnnDebug('viewport:LOD debounced rebuild', {
        panX,
        panY,
        zoom,
        vw,
        vh,
        groups: visibleBulkAnnotationGroupUIDs.size,
      })
      for (const uid of visibleBulkAnnotationGroupUIDs) {
        if (bulkGraphicCacheByUidRef.current[uid] == null) {
          continue
        }
        runBulkViewportRebuildForGroup(uid)
      }
    }, VIV_BULK_VIEWPORT_REBUILD_MS)

    return () => {
      window.clearTimeout(timer)
      for (const uid of Object.keys(bulkViewportRebuildGenRef.current)) {
        bulkViewportRebuildGenRef.current[uid] =
          (bulkViewportRebuildGenRef.current[uid] ?? 0) + 1
      }
    }
  }, [
    loadBulkAnnotations,
    baseLayer,
    viewState.target[0],
    viewState.target[1],
    viewState.zoom,
    size.width,
    size.height,
    visibleBulkAnnotationGroupUIDs,
    runBulkViewportRebuildForGroup,
  ])

  const sp = slideRef.current
  const orthoZoomClamp =
    sp && !loading
      ? orthographicZoomLimits(
          size.width,
          size.height,
          sp.worldW,
          sp.worldH,
          sp.levelCount,
        )
      : { minZoom: Number.NEGATIVE_INFINITY, maxZoom: Number.POSITIVE_INFINITY }

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
      <div ref={slotRef} style={{ position: 'absolute', inset: 0 }}>
        <DeckGL
          views={orthographicView}
          viewState={{
            ...viewState,
            ...orthoZoomClamp,
          }}
          onViewStateChange={({ viewState: vs }) => {
            if (
              vs &&
              typeof vs === 'object' &&
              'zoom' in vs &&
              'target' in vs
            ) {
              const sr = slideRef.current
              if (!sr) {
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
              const zClamped = Math.min(
                lim.maxZoom,
                Math.max(lim.minZoom, rawZ),
              )
              const zq = Number(zClamped.toFixed(5))
              const t = vs.target as [number, number] | [number, number, number]
              setViewState({
                target: [t[0], t[1], t[2] ?? 0],
                zoom: zq,
              })
            }
          }}
          controller={{ inertia: false }}
          layers={layers}
          width={size.width}
          height={size.height}
        />
      </div>
    </div>
  )
}

export default VivSlideViewport

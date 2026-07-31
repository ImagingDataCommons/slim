import type { Layer, PickingInfo } from '@deck.gl/core'
import { OrthographicView } from '@deck.gl/core'
import DeckGL, { type DeckGLRef } from '@deck.gl/react'
import { Matrix4 } from '@math.gl/core'
import { MultiscaleImageLayer } from '@vivjs/layers'
import { message, Spin } from 'antd'
import type React from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import type { VivSettings } from '../AppConfig'
import HoveredRoiTooltip from '../components/HoveredRoiTooltip'
import VivBulkAnnotationLoadIndicator from '../components/VivBulkAnnotationLoadIndicator'
import type DicomWebManager from '../DicomWebManager'
import {
  getIccProfilesEnabled,
  setIccProfilesEnabled,
  subscribeIccProfilesEnabled,
} from '../preferences/iccProfilesPreference'
import { logger } from '../utils/logger'
import { CenterOutTileset2D } from './centerOutTileset'
import {
  DicomLoader,
  isVivDicomTileNetworkCancellation,
  vivCoarsestLevelSupportsBackgroundRaster,
} from './dicomLoader'
import {
  bulkGroupUidFromDeckLayerId,
  type VivBulkAnnotationCatalogPayload,
  vivBulkAnnotationHoverAttributes,
} from './loadBulkAnnotationLayers'
import { useVivBulkAnnotations } from './useVivBulkAnnotations'
import type { VivBulkAnnotationLoadStatus } from './vivBulkLoadStatus'
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
  onBulkAnnotationLoadStatusChange,
  onIccProfilesAvailabilityChange,
  studyInstanceUID,
  seriesInstanceUID,
  vivSettings,
}) => {
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
  const deckRef = useRef<DeckGLRef>(null)
  const imageDeckRef = useRef<DeckGLRef>(null)
  const baseLayerRef = useRef<Layer | null>(null)
  const [size, setSize] = useState({ width: 100, height: 100 })
  const [baseLayer, setBaseLayer] = useState<Layer | null>(null)
  baseLayerRef.current = baseLayer
  const baseLayerReady = baseLayer !== null

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
    fitDoneRef.current = false
    slideRef.current = null
    slideMatrixRef.current = null
    setLoading(true)
    setBaseLayer(null)
    setBulkHoverTooltip(null)
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
      dicomLoaderRef.current?.dispose()
      dicomLoaderRef.current = null
    }
  }, [client, studyInstanceUID, seriesInstanceUID, createMultiscaleFromLoader])

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

  const {
    annLayers,
    bulkLoadStatus,
    bulkHydrateTileThrottle,
    bulkMetadataByUidRef,
  } = useVivBulkAnnotations({
    enabled: loadBulkAnnotations,
    baseLayerReady,
    client,
    bulkAnnotationClient,
    studyInstanceUID,
    seriesInstanceUID,
    visibleGroupUIDs: visibleBulkAnnotationGroupUIDs,
    groupStyles: bulkAnnotationGroupStyles,
    onCatalogChange: onBulkAnnotationCatalogChange,
    onLoadStatusChange: onBulkAnnotationLoadStatusChange,
    dicomLoaderRef,
    slideRef,
    slideMatrixRef,
    viewState,
    viewStateRef,
    size,
    sizeRef,
    annotationDeckRef: deckRef,
  })

  const handleBulkDeckHover = useCallback(
    (info: PickingInfo) => {
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
    },
    [bulkMetadataByUidRef],
  )
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

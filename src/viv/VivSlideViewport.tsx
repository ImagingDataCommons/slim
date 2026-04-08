import type { Layer } from '@deck.gl/core'
import { OrthographicView } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { MultiscaleImageLayer } from '@vivjs/layers'
import { message, Spin } from 'antd'
import type React from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { VivSettings } from '../AppConfig'
import type DicomWebManager from '../DicomWebManager'
import {
  DicomLoader,
  isVivDicomTileNetworkCancellation,
  type BulkAnnotationGeometryContext,
} from './dicomLoader'
import {
  hydrateVivBulkGroupLayerSlice,
  loadBulkAnnotationMetadataAndJobs,
  type VivBulkAnnotationCatalogPayload,
  type VivBulkAnnotationLayerSlice,
  type VivBulkGroupGeometryJob,
} from './loadBulkAnnotationLayers'
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
  studyInstanceUID: string
  seriesInstanceUID: string
  vivSettings?: VivSettings
}

function buildStyledBulkOverlayLayers(
  slicesByUid: Record<string, VivBulkAnnotationLayerSlice>,
  visibleUIDs: Set<string>,
  styles: Record<string, { opacity: number; color: number[] }>,
  defaultStyles: Record<string, { opacity: number; color: number[] }>,
): Layer[] {
  const out: Layer[] = []
  for (const uid of visibleUIDs) {
    const slice = slicesByUid[uid]
    if (slice == null) {
      continue
    }
    const st =
      styles[uid] ??
      defaultStyles[uid] ?? {
        opacity: 1,
        color: [220, 60, 60],
      }
    const a = Math.round(
      Math.max(0, Math.min(1, st.opacity)) * 220,
    )
    const rgba: [number, number, number, number] = [
      st.color[0] ?? 0,
      st.color[1] ?? 0,
      st.color[2] ?? 0,
      a,
    ]
    for (const layer of slice.layers) {
      const lid = String(layer.id)
      if (lid.endsWith('-paths')) {
        out.push(
          (layer as PathLayer).clone({ getColor: (): typeof rgba => rgba }),
        )
      } else if (lid.endsWith('-pts')) {
        out.push(
          (layer as ScatterplotLayer).clone({
            getFillColor: (): typeof rgba => rgba,
          }),
        )
      } else {
        out.push(layer)
      }
    }
  }
  return out
}

const orthographicView = new OrthographicView()

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
  studyInstanceUID,
  seriesInstanceUID,
  vivSettings,
}) => {
  const catalogCbRef = useRef(onBulkAnnotationCatalogChange)
  catalogCbRef.current = onBulkAnnotationCatalogChange

  const vivRef = useRef(vivSettings)
  vivRef.current = vivSettings

  const slotRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<(() => void) | null>(null)
  const slideRef = useRef<{
    worldW: number
    worldH: number
    levelCount: number
  } | null>(null)
  const fitDoneRef = useRef(false)
  /** Same loader instance that built `baseLayer` (for geometry + ANN bulk fetches only). */
  const dicomLoaderRef = useRef<DicomLoader | null>(null)
  const bulkGeometryRef = useRef<BulkAnnotationGeometryContext | null>(null)
  const bulkGroupJobsRef = useRef<Record<string, VivBulkGroupGeometryJob>>({})
  const bulkHydrateInFlightRef = useRef<Set<string>>(new Set())
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
  const annLayers = useMemo((): Layer[] => {
    return buildStyledBulkOverlayLayers(
      bulkSlicesByUid,
      visibleBulkAnnotationGroupUIDs,
      bulkAnnotationGroupStyles,
      bulkDefaultStyles,
    )
  }, [
    bulkSlicesByUid,
    visibleBulkAnnotationGroupUIDs,
    bulkAnnotationGroupStyles,
    bulkDefaultStyles,
  ])
  const layers = useMemo((): Layer[] => {
    return baseLayer !== null ? [baseLayer, ...annLayers] : []
  }, [baseLayer, annLayers])
  const [loading, setLoading] = useState(true)
  const [viewState, setViewState] = useState<ViewState>({
    target: [0, 0, 0],
    zoom: -6,
  })
  const sizeRef = useRef(size)
  sizeRef.current = size

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
    setLoading(true)
    setBaseLayer(null)
    setBulkSlicesByUid({})
    setBulkDefaultStyles({})
    bulkGeometryRef.current = null
    bulkGroupJobsRef.current = {}
    bulkHydrateInFlightRef.current.clear()
    catalogCbRef.current?.(null)
    dicomLoaderRef.current = null

    const run = async (): Promise<void> => {
      try {
        const dicomLoader = new DicomLoader(client, {
          studyInstanceUID,
          seriesInstanceUID,
        })
        dicomLoaderRef.current = dicomLoader
        const sources = await dicomLoader.getSources()
        if (cancelled) {
          return
        }
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
        /*
         * Non-geospatial TileLayer already uses getScale(z, tileSize) = 2^z * (512 / tileSize), so
         * 256px DICOM tiles get the right world step. Do not also pass modelMatrix + scaled viewState:
         * MultiscaleImageLayer derives zoomOffset from modelMatrix, and scaling the camera to match
         * double-corrects — coarse levels can look fine while the finest z slips vs the pyramid.
         */
        const layer = new MultiscaleImageLayer({
          id: 'slim-viv-multiscale',
          loader: sources as never,
          selections: d.selections,
          channelsVisible: d.channelsVisible,
          contrastLimits: d.contrastLimits,
          dtype: sources[0].dtype,
          // Lowest pyramid level is often wider/taller than one tile; ImageLayer would call getRaster and fail.
          excludeBackground: true,
          // Omit refinementStrategy → Viv uses best-available when opacity=1; smoother hand-off between pyramid levels than no-overlap.
          onTileError: (err: Error) => {
            if (isVivDicomTileNetworkCancellation(err)) {
              return
            }
            console.error(err)
          },
        })

        if (cancelled) {
          return
        }

        setBaseLayer(layer as unknown as Layer)
        slideRef.current = {
          worldW: sw,
          worldH: sh,
          levelCount: sources.length,
        }

        if (vivSettings?.initialViewState?.zoom != null) {
          const el = slotRef.current
          const vw = el ? Math.max(1, el.clientWidth) : 800
          const vh = el ? Math.max(1, el.clientHeight) : 600
          const lim = orthographicZoomLimits(vw, vh, sw, sh, sources.length)
          const z0 = vivSettings.initialViewState.zoom
          const z = Math.min(lim.maxZoom, Math.max(lim.minZoom, z0))
          setViewState({
            target: d.initialViewState.target,
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
      } catch (err) {
        console.error(err)
        if (!cancelled) {
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
  }, [client, studyInstanceUID, seriesInstanceUID, vivSettings])

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
      console.warn(
        '[Viv bulk ANN] viewport: no DicomLoader ref — wait for slide to finish loading',
      )
      return
    }

    let cancelled = false
    console.info(
      '[Viv bulk ANN] viewport: loading overlays (image layer unchanged)…',
      {
        studyInstanceUID,
        seriesInstanceUID,
        usesDedicatedAnnClient:
          bulkAnnotationClient != null && bulkAnnotationClient !== client,
      },
    )

    const run = async (): Promise<void> => {
      try {
        const geometry = await dicomLoader.getBulkAnnotationGeometryContext()
        const loaded = await loadBulkAnnotationMetadataAndJobs({
          geometry,
          studyInstanceUID,
          imageSeriesInstanceUID: seriesInstanceUID,
          annotationClient: bulkAnnotationClient ?? client,
          fetchClient: client,
        })
        if (!cancelled) {
          const { groupGeometryJobs, ...catalog } = loaded
          bulkGeometryRef.current = geometry
          bulkGroupJobsRef.current = groupGeometryJobs
          bulkHydrateInFlightRef.current.clear()
          setBulkSlicesByUid({})
          setBulkDefaultStyles(loaded.defaultStylesByGroupUID)
          catalogCbRef.current?.(catalog)
          console.info('[Viv bulk ANN] viewport: metadata catalog ready', {
            annotationGroups: loaded.annotationGroups.length,
            lazyGeometryJobs: Object.keys(groupGeometryJobs).length,
          })
        }
      } catch (e) {
        console.warn('[Viv bulk ANN] viewport: overlay load failed', e)
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
      void hydrateVivBulkGroupLayerSlice({
        job,
        geometry: geom,
        fetchClient: client,
      }).then((slice) => {
        bulkHydrateInFlightRef.current.delete(uid)
        if (slice == null || !visibleBulkUidsRef.current.has(uid)) {
          return
        }
        setBulkSlicesByUid((prev) => {
          if (prev[uid] != null) {
            return prev
          }
          return { ...prev, [uid]: slice }
        })
      })
    }
  }, [
    loadBulkAnnotations,
    baseLayer,
    visibleBulkAnnotationGroupUIDs,
    client,
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

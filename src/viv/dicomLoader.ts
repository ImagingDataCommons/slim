/**
 * Ported from https://github.com/jmuhlich/viv-dicomweb-test (dicomweb.js).
 * Adapts dicom-microscopy-viewer tile loaders to Viv PixelSource.
 */

import { SIGNAL_ABORTED } from '@vivjs/loaders'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
// skipcq: JS-C1003
import type * as dwc from 'dicomweb-client'
import type DicomWebManager from '../DicomWebManager'
import { logger } from '../utils/logger'
import { trimVolumeImageViewerFootprint } from './trimVolumeImageViewer'
import {
  clearVivXhrTileAbortMeta,
  installVivDicomwebAbortHooks,
  invokeOpenLayersLoaderWithAbortSignal,
  vivXhrTileAbortMeta,
} from './vivAbortBridge'
import {
  vivBulkAnnDebug,
  vivBulkAnnNow,
  vivBulkAnnPerf,
} from './vivBulkAnnDebug'

export interface DicomRetrieveOptions {
  studyInstanceUID: string
  seriesInstanceUID: string
}

/** Viv loader options; ICC defaults match {@link dmv.viewer.VolumeImageViewer} (enabled). */
export interface DicomLoaderOptions {
  /** When false, tile decode skips ICC transforms (same as OpenLayers viewer toggle). */
  iccProfilesEnabled?: boolean
}

type OpticalPathEntry = {
  pyramid: {
    metadata: Array<{
      TotalPixelMatrixRows: number
      TotalPixelMatrixColumns: number
      Columns: number
      Rows: number
    }>
    /** Per pyramid level: [Columns, Rows] for that resolution. */
    tileSizes: Array<[number, number]>
  }
  layer: {
    getSource: () => {
      loader_: (
        z: number,
        requestX: number,
        requestY: number,
      ) => Promise<ArrayBuffer>
    }
  }
}

/** OpenLayers DataTileSource sets this asynchronously inside VolumeImageViewer.render(). */
/**
 * OpenLayers DataTile passes `(z, requestX, requestY)`. dicom-microscopy-viewer's
 * `_createTileLoadFunction` names those `(z, y, x)` but builds the frame id as
 * `${x+1}-${y+1}` → `(requestY+1)-(requestX+1)` in OL terms.
 */
function getDataTileLoader(
  source: { loader_?: unknown } | null,
):
  | ((z: number, requestX: number, requestY: number) => Promise<ArrayBuffer>)
  | undefined {
  const fn = source?.loader_
  return typeof fn === 'function'
    ? (fn as (
        z: number,
        requestX: number,
        requestY: number,
      ) => Promise<ArrayBuffer>)
    : undefined
}

/**
 * `render()` triggers `forEach(async …)` ICC fetches and only then `setLoader`.
 * A single rAF returns before loaders exist; wait until every optical path source is ready.
 */
async function waitForOpenLayersTileLoaders(
  opticalPaths: { [key: string]: OpticalPathEntry },
  timeoutMs: number,
): Promise<void> {
  const paths = Object.values(opticalPaths)
  if (paths.length === 0) {
    return
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = paths.every((p) => {
      const loader = getDataTileLoader(
        p.layer.getSource() as { loader_?: unknown } | null,
      )
      return loader !== undefined
    })
    if (ready) {
      return
    }
    await new Promise<void>((r) => {
      setTimeout(r, 50)
    })
  }
  const missing = Object.entries(opticalPaths)
    .filter(([, p]) => {
      return (
        getDataTileLoader(
          p.layer.getSource() as { loader_?: unknown } | null,
        ) === undefined
      )
    })
    .map(([id]) => id)
  throw new Error(
    `Timed out waiting for OpenLayers tile loaders (still missing: ${missing.join(', ') || 'unknown'}).`,
  )
}

/**
 * After {@link dmv.viewer.VolumeImageViewer.toggleICCProfiles}, DMV flips ICC state
 * synchronously but replaces `source.loader_` inside async `_getIccProfiles` callbacks.
 * {@link waitForOpenLayersTileLoaders} is not enough: the old loader stays defined until then.
 * Poll until each path's loader function reference differs from the pre-toggle snapshot.
 */
async function waitForTileLoadersAfterIccToggle(
  opticalPaths: { [key: string]: OpticalPathEntry },
  loadersBeforeToggle: Record<
    string,
    | ((z: number, requestX: number, requestY: number) => Promise<ArrayBuffer>)
    | undefined
  >,
  timeoutMs: number,
): Promise<void> {
  const entries = Object.entries(opticalPaths)
  if (entries.length === 0) {
    return
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = entries.every(([id, p]) => {
      const curr = getDataTileLoader(
        p.layer.getSource() as { loader_?: unknown } | null,
      )
      const prev = loadersBeforeToggle[id]
      if (prev === undefined) {
        return curr !== undefined
      }
      return curr !== undefined && curr !== prev
    })
    if (ready) {
      return
    }
    await new Promise<void>((r) => {
      setTimeout(r, 50)
    })
  }
  const stale = entries
    .filter(([id, p]) => {
      const curr = getDataTileLoader(
        p.layer.getSource() as { loader_?: unknown } | null,
      )
      const prev = loadersBeforeToggle[id]
      if (prev === undefined) {
        return curr === undefined
      }
      return curr === undefined || curr === prev
    })
    .map(([id]) => id)
  throw new Error(
    `Timed out waiting for ICC toggle to refresh OpenLayers tile loaders (still stale: ${stale.join(', ') || 'unknown'}).`,
  )
}

function isXhrLike(req: unknown): req is XMLHttpRequest {
  if (req === null || typeof req !== 'object') {
    return false
  }
  const candidate = req as {
    open?: unknown
    abort?: unknown
    readyState?: unknown
  }
  return (
    typeof candidate.open === 'function' &&
    typeof candidate.abort === 'function' &&
    typeof candidate.readyState === 'number'
  )
}

/** Walk `cause` / `errors` (AggregateError); avoid `instanceof XMLHttpRequest` (dev proxies break it). */
function xhrFromDicomwebErrorDeep(e: unknown): XMLHttpRequest | undefined {
  let cur: unknown = e
  const seen = new Set<unknown>()
  while (cur !== null && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    const errObj = cur as {
      request?: unknown
      cause?: unknown
      errors?: unknown[]
    }
    if (isXhrLike(errObj.request)) {
      return errObj.request
    }
    if (Array.isArray(errObj.errors)) {
      for (const sub of errObj.errors) {
        const xhr = xhrFromDicomwebErrorDeep(sub)
        if (xhr !== undefined) {
          return xhr
        }
      }
    }
    cur = errObj.cause
  }
  return undefined
}

/** dicomweb-client rejects with XHR status `0` and message `request failed` after `abort()`. */
function dicomwebAbortedRequestErrorDeep(e: unknown): boolean {
  let cur: unknown = e
  const seen = new Set<unknown>()
  while (cur !== null && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    const errObj = cur as {
      message?: string
      status?: number
      cause?: unknown
      errors?: unknown[]
    }
    if (errObj.message === 'request failed' && errObj.status === 0) {
      return true
    }
    if (Array.isArray(errObj.errors)) {
      for (const sub of errObj.errors) {
        if (dicomwebAbortedRequestErrorDeep(sub)) {
          return true
        }
      }
    }
    cur = errObj.cause
  }
  return false
}

/**
 * dicom-microscopy-viewer wraps dicomweb failures in `new Error('Failed to load frames…', err)`; some
 * engines omit `cause` or attach the inner error elsewhere — scan messages on `cause` / `errors`.
 */
function requestFailedMessageInErrorTree(e: unknown): boolean {
  const stack: unknown[] = [e]
  const seen = new Set<unknown>()
  while (stack.length > 0) {
    const cur = stack.pop()
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      continue
    }
    if (seen.has(cur)) {
      continue
    }
    seen.add(cur)
    const msg = (cur as Error).message
    if (typeof msg === 'string' && msg.includes('request failed')) {
      return true
    }
    const cause = (cur as { cause?: unknown }).cause
    if (cause !== undefined) {
      stack.push(cause)
    }
    const errors = (cur as { errors?: unknown[] }).errors
    if (Array.isArray(errors)) {
      for (const sub of errors) {
        stack.push(sub)
      }
    }
  }
  return false
}

/** Bounded search for dicomweb’s `{ message: 'request failed', status: 0 }` on nested properties. */
function objectGraphHasDicomwebTileAbort(root: unknown): boolean {
  if (root === null || typeof root !== 'object') {
    return false
  }
  const queue: unknown[] = [root]
  const seen = new Set<unknown>()
  let nodes = 0
  const maxNodes = 48
  while (queue.length > 0 && nodes < maxNodes) {
    const item = queue.shift()
    if (item === null || typeof item !== 'object' || seen.has(item)) {
      continue
    }
    seen.add(item)
    nodes++
    const obj = item as Record<string, unknown>
    const msg = obj.message
    const statusCode = obj.status
    const msgStr = typeof msg === 'string' ? msg : ''
    if (
      statusCode === 0 &&
      (msg === 'request failed' || msgStr.includes('request failed'))
    ) {
      return true
    }
    for (const val of Object.values(obj)) {
      if (val !== null && typeof val === 'object') {
        queue.push(val)
      }
    }
  }
  return false
}

/** True when the OpenLayers→pyramid→dicomweb chain failed due to XHR abort / prune. */
export function isVivDicomTileNetworkCancellation(e: unknown): boolean {
  return (
    dicomwebAbortedRequestErrorDeep(e) ||
    requestFailedMessageInErrorTree(e) ||
    objectGraphHasDicomwebTileAbort(e)
  )
}

const dicomwebClientsWithVivAbortHooks = new WeakSet<dwc.api.DICOMwebClient>()

/** Same slide/map space as OpenLayers VolumeImageViewer (finest pyramid, affine). */
export interface BulkAnnotationGeometryContext {
  pyramid: dmv.metadata.VLWholeSlideMicroscopyImage[]
  affine: number[][]
  affineInverse: number[][]
  /** OL map extent [minX, minY, maxX, maxY] for bulk-annotation viewport helpers. */
  extent: number[]
}

function readVolumeImageViewerAffine(
  viewer: dmv.viewer.VolumeImageViewer,
): number[][] {
  const viewerRecord = viewer as unknown as Record<symbol, unknown>
  const affineMatrix = viewerRecord[Symbol.for('affine')]
  if (!Array.isArray(affineMatrix)) {
    throw new Error('VolumeImageViewer: affine transform not available')
  }
  return affineMatrix as number[][]
}

function readVolumeImageViewerAffineInverse(
  viewer: dmv.viewer.VolumeImageViewer,
): number[][] {
  const sym = Object.getOwnPropertySymbols(viewer).find(
    (symbolRef) => symbolRef.description === 'affineInverse',
  )
  if (sym === undefined) {
    throw new Error('VolumeImageViewer: affineInverse symbol not found')
  }
  const viewerRecord = viewer as unknown as Record<symbol, unknown>
  const affineInverseMatrix = viewerRecord[sym]
  if (!Array.isArray(affineInverseMatrix)) {
    throw new Error('VolumeImageViewer: affine inverse not available')
  }
  return affineInverseMatrix as number[][]
}

function readVolumeImageViewerPyramid(viewer: dmv.viewer.VolumeImageViewer): {
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  extent: number[]
} {
  const sym = Object.getOwnPropertySymbols(viewer).find(
    (s) => s.description === 'pyramid',
  )
  if (sym === undefined) {
    throw new Error('VolumeImageViewer: pyramid symbol not found')
  }
  const raw = (
    viewer as unknown as Record<symbol, { metadata: unknown; extent: unknown }>
  )[sym]
  if (
    raw === null ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as { metadata?: unknown }).metadata) ||
    !Array.isArray((raw as { extent?: unknown }).extent)
  ) {
    throw new Error('VolumeImageViewer: invalid pyramid object')
  }
  return {
    metadata: (raw as { metadata: dmv.metadata.VLWholeSlideMicroscopyImage[] })
      .metadata,
    extent: (raw as { extent: number[] }).extent,
  }
}

function getOpticalPathsMap(viewer: dmv.viewer.VolumeImageViewer): {
  [key: string]: OpticalPathEntry
} {
  const sym = Object.getOwnPropertySymbols(viewer).find(
    (s) => s.description === 'opticalPaths',
  )
  if (sym === undefined) {
    throw new Error(
      'dicom-microscopy-viewer VolumeImageViewer: opticalPaths symbol not found',
    )
  }
  const raw = viewer[sym as unknown as keyof dmv.viewer.VolumeImageViewer]
  return raw as unknown as { [key: string]: OpticalPathEntry }
}

/**
 * DMV `VolumeImageViewer` starts with ICC on. When the app preference is off,
 * flip the private flag *before* the first `render()` so tile loaders are built
 * without ICC — avoids `toggleICCProfiles()` which re-downloads every ICC bulk URI.
 */
function setVolumeImageViewerIccEnabled(
  viewer: dmv.viewer.VolumeImageViewer,
  enabled: boolean,
): void {
  const sym = Object.getOwnPropertySymbols(viewer).find(
    (s) => s.description === 'isICCProfilesEnabled',
  )
  if (sym === undefined) {
    throw new Error(
      'dicom-microscopy-viewer VolumeImageViewer: isICCProfilesEnabled symbol not found',
    )
  }
  ;(viewer as unknown as Record<symbol, boolean>)[sym] = enabled
}

export class DicomLoader {
  private readonly _client: DicomWebManager

  private readonly _retrieveOptions: DicomRetrieveOptions

  private _viewer?: dmv.viewer.VolumeImageViewer

  /**
   * In-flight viewer construction. Memoizing the promise (not the resolved value)
   * prevents two concurrent first calls from building two hidden viewers and
   * leaking one. Cleared on failure so a transient error does not brick the loader.
   */
  private _viewerPromise?: Promise<dmv.viewer.VolumeImageViewer>

  /**
   * Single-flight guard for render/tile-loader priming + ICC sync. Concurrent
   * callers (e.g. `warmIccTileLoaders` and in-flight `getTile`s) must share one
   * `toggleICCProfiles()` — two concurrent toggles cancel each other out.
   */
  private _viewerReadyPromise?: Promise<void>

  /** Set by {@link dispose}; async chains must never rebuild the viewer afterwards. */
  private _disposed = false

  private _opticalPaths?: { [key: string]: OpticalPathEntry }

  private _tileSize?: number

  private _loaders?: {
    [channel: string]: (
      level: number,
      x: number,
      y: number,
    ) => Promise<ArrayBuffer>
  }

  /**
   * {@link trimVolumeImageViewerFootprint} runs once per loader cache generation.
   * Clearing OL tile caches on every {@link getTile} breaks parallel pyramid fetches.
   */
  private _openLayersFootprintTrimmed = false

  /**
   * True after the first successful hidden `VolumeImageViewer.render()` + tile-loader wait.
   * Re-calling `render()` re-fetches every ICC bulkdata URI (DMV has no hasLoader guard).
   */
  private _openLayersTilesPrimed = false

  /**
   * Target ICC setting from app (SlideViewer parity). DMV viewer defaults to ICC on;
   * we sync with toggleICCProfiles + invalidate cached DataTile loaders.
   */
  private _iccTarget: boolean

  /** Last known ICC state after sync (mirrors VolumeImageViewer internal default). */
  private _iccProfilesEnabled = true

  private _shapes?: Array<
    [number, number, number] | [number, number, number, number]
  >

  /**
   * Optical path ids from dicom-microscopy-viewer (DICOM OpticalPathIdentifier),
   * sorted for stable Viv channel index { c: 0 .. n-1 }.
   */
  private _orderedPathKeys?: string[]

  private readonly _pathIdByChannelIndex = new Map<number, string>()

  /** Frame columns per DICOM pyramid level (index 0 = coarsest). */
  private _columnsByLevel?: number[]

  private _tileDecodeReady?: Promise<void>

  /**
   * Decoded tiles keyed by DICOM pyramid level + optical path + tile index.
   * Speeds zooming back to a previously visited resolution (deck cache is separate).
   */
  private readonly _decodedTileCache = new Map<
    string,
    {
      data: Uint8Array | Uint16Array
      width: number
      height: number
      bytes: number
    }
  >()

  private _decodedTileCacheBytes = 0

  /**
   * Bumped whenever the decoded-tile cache is cleared (e.g. ICC toggle) so tiles
   * decoded under the previous state cannot poison the fresh cache when they resolve.
   */
  private _decodedTileCacheGeneration = 0

  /** Set when the viewer is first built; 8- or 16-bit SM tiles both load as float then convert to Uint16 in getTile. */
  bitsAllocated?: 8 | 16

  /** Samples per pixel for SM instances (1 = monochrome paths, 3 = RGB color slide). */
  samplesPerPixel?: number

  constructor(
    client: DicomWebManager,
    retrieveOptions: DicomRetrieveOptions,
    options?: DicomLoaderOptions,
  ) {
    this._client = client
    this._retrieveOptions = retrieveOptions
    this._iccTarget = options?.iccProfilesEnabled ?? true
    this._iccProfilesEnabled = true
  }

  /**
   * Apply ICC on/off (matches SlideViewer → volumeViewer.toggleICCProfiles).
   * Clears cached tile loader functions so getTile reads fresh loader_ from OL sources.
   */
  setIccProfilesEnabled(enabled: boolean): void {
    if (this._iccTarget === enabled) {
      return
    }
    this._iccTarget = enabled
    this._loaders = undefined
    this._openLayersFootprintTrimmed = false
    this._pathIdByChannelIndex.clear()
    this._columnsByLevel = undefined
    this._tileDecodeReady = undefined
    this._clearDecodedTileCache()
    /** Keep `_openLayersTilesPrimed`: toggle refreshes loaders without a second render(). */
  }

  private _clearDecodedTileCache(): void {
    this._decodedTileCache.clear()
    this._decodedTileCacheBytes = 0
    this._decodedTileCacheGeneration++
  }

  // skipcq: JS-0105 - method kept as instance method for consistency with cache operations
  private _decodedTileCacheKey(
    level: number,
    channel: string,
    x: number,
    y: number,
  ): string {
    return `${level}:${channel}:${x}:${y}`
  }

  private _rememberDecodedTile(
    key: string,
    tile: {
      data: Uint8Array | Uint16Array
      width: number
      height: number
    },
    generation: number,
  ): void {
    if (generation !== this._decodedTileCacheGeneration) {
      /** Tile was decoded under a previous cache state (e.g. old ICC transform). */
      return
    }
    const bytes = tile.data.byteLength
    const maxBytes = 384 * 1024 * 1024
    const prev = this._decodedTileCache.get(key)
    if (prev !== undefined) {
      this._decodedTileCacheBytes -= prev.bytes
      this._decodedTileCache.delete(key)
    }
    this._decodedTileCache.set(key, { ...tile, bytes })
    this._decodedTileCacheBytes += bytes
    while (
      this._decodedTileCacheBytes > maxBytes &&
      this._decodedTileCache.size > 0
    ) {
      const oldest = this._decodedTileCache.keys().next().value
      if (oldest === undefined) {
        break
      }
      const evicted = this._decodedTileCache.get(oldest)
      if (evicted !== undefined) {
        this._decodedTileCacheBytes -= evicted.bytes
      }
      this._decodedTileCache.delete(oldest)
    }
  }

  /**
   * Release the hidden OpenLayers {@link dmv.viewer.VolumeImageViewer} and cached loaders.
   * Call when the Viv viewport unmounts or the series changes.
   */
  dispose(): void {
    this._disposed = true
    this._loaders = undefined
    this._openLayersFootprintTrimmed = false
    this._openLayersTilesPrimed = false
    this._pathIdByChannelIndex.clear()
    this._columnsByLevel = undefined
    this._tileDecodeReady = undefined
    this._viewerReadyPromise = undefined
    this._viewerPromise = undefined
    this._clearDecodedTileCache()
    this._opticalPaths = undefined
    this._orderedPathKeys = undefined
    this._shapes = undefined
    this._tileSize = undefined
    const viewer = this._viewer
    this._viewer = undefined
    if (viewer === undefined) {
      return
    }
    try {
      viewer.cleanup()
    } catch (err) {
      logger.warn('DicomLoader: VolumeImageViewer.cleanup failed', err)
    }
  }

  /**
   * After {@link setIccProfilesEnabled}, rebuild OpenLayers tile loaders so decoded pixels
   * match the current ICC state. Call before rebuilding a Viv MultiscaleImageLayer; otherwise
   * Deck may keep serving tiles from the previous loader_ until a tile is refetched.
   */
  async warmIccTileLoaders(): Promise<void> {
    this._ensureVivAbortHooks()
    this._loaders = undefined
    this._openLayersFootprintTrimmed = false
    this._pathIdByChannelIndex.clear()
    this._columnsByLevel = undefined
    this._tileDecodeReady = undefined
    this._clearDecodedTileCache()
    /**
     * Share the `_tileDecodeReady` memo with in-flight `getTile` calls so both
     * observe one ICC sync (see {@link _ensureViewerReadyForTiles} single-flight).
     */
    await this._ensureTileDecodeReady()
  }

  /** Number of ICC profiles available for color correction (0 ⇒ disable toggle in UI). */
  async getIccProfilesLength(): Promise<number> {
    this._ensureVivAbortHooks()
    /**
     * Do not re-enter `render()` here — that re-downloads every ICC Profile bulk URI.
     * Tile priming already waited for ICC-backed loaders when present.
     */
    await this._ensureViewerReadyForTiles()
    const viewer = await this._getViewer()
    return viewer.getICCProfiles().length
  }

  /**
   * Ensure VolumeImageViewer ICC state matches {@link _iccTarget} (one toggle flips DMV state).
   * Only ever runs inside the single-flight {@link _ensureViewerReadyForTiles} path, so no
   * two toggles can race; the loop converges if `_iccTarget` changes during the loader wait.
   */
  private async _syncIccWithVolumeViewer(
    viewer: dmv.viewer.VolumeImageViewer,
    opticalPaths: { [key: string]: OpticalPathEntry },
  ): Promise<void> {
    while (this._iccProfilesEnabled !== this._iccTarget) {
      const loadersBeforeToggle = Object.fromEntries(
        Object.entries(opticalPaths).map(([id, p]) => {
          return [
            id,
            getDataTileLoader(
              p.layer.getSource() as { loader_?: unknown } | null,
            ),
          ]
        }),
      )
      viewer.toggleICCProfiles()
      await waitForTileLoadersAfterIccToggle(
        opticalPaths,
        loadersBeforeToggle,
        120_000,
      )
      /** Record what the toggle actually did — `_iccTarget` may have moved mid-wait. */
      this._iccProfilesEnabled = !this._iccProfilesEnabled
    }
  }

  /**
   * Render hidden OL viewer once, wait for DataTile loaders, apply ICC target vs DMV.
   * Subsequent calls only re-sync ICC (toggle) — never re-`render()` (ICC re-fetch storm).
   *
   * Single-flight: concurrent callers share one in-progress promise so
   * `toggleICCProfiles()` is never invoked twice for the same target (two
   * toggles cancel out and tiles would render with the wrong ICC transform).
   */
  private async _ensureViewerReadyForTiles(): Promise<void> {
    if (this._disposed) {
      throw new Error('DicomLoader: disposed')
    }
    if (this._viewerReadyPromise === undefined) {
      const ready = this._ensureViewerReadyForTilesImpl().finally(() => {
        if (this._viewerReadyPromise === ready) {
          this._viewerReadyPromise = undefined
        }
      })
      this._viewerReadyPromise = ready
    }
    return await this._viewerReadyPromise
  }

  private async _ensureViewerReadyForTilesImpl(): Promise<void> {
    const viewer = await this._getViewer()
    const opticalPaths = await this._getOpticalPaths()
    if (!this._openLayersTilesPrimed) {
      /**
       * Pref matches DMV default (on): render once, no toggle.
       * Pref off: set DMV flag before render so loaders skip ICC transforms without
       * calling `toggleICCProfiles()` (which would re-fetch all ICC bulkdata).
       */
      if (!this._iccTarget) {
        setVolumeImageViewerIccEnabled(viewer, false)
        this._iccProfilesEnabled = false
      }
      viewer.render({ container: document.createElement('div') })
      await waitForOpenLayersTileLoaders(opticalPaths, 120_000)
      this._openLayersTilesPrimed = true
    }
    await this._syncIccWithVolumeViewer(viewer, opticalPaths)
  }

  private _ensureVivAbortHooks(): void {
    this._client.applyToPrimaryDicomwebClient((inner) => {
      if (dicomwebClientsWithVivAbortHooks.has(inner)) {
        return
      }
      dicomwebClientsWithVivAbortHooks.add(inner)
      installVivDicomwebAbortHooks(
        inner as Parameters<typeof installVivDicomwebAbortHooks>[0],
      )
    })
  }

  /** Shrink hidden OL map + drop cached tiles once tile `loader_` refs are cached. */
  private _trimOpenLayersFootprint(): void {
    const viewer = this._viewer
    const opticalPaths = this._opticalPaths
    if (viewer === undefined || opticalPaths === undefined) {
      return
    }
    trimVolumeImageViewerFootprint(
      viewer,
      opticalPaths as Parameters<typeof trimVolumeImageViewerFootprint>[1],
    )
  }

  private async _getViewer(): Promise<dmv.viewer.VolumeImageViewer> {
    if (this._disposed) {
      throw new Error(
        'DicomLoader: disposed — refusing to rebuild hidden VolumeImageViewer',
      )
    }
    if (this._viewerPromise === undefined) {
      const creation = this._createViewer()
      this._viewerPromise = creation
      creation.catch(() => {
        /** Transient failure (e.g. metadata fetch) must not brick the loader. */
        if (this._viewerPromise === creation) {
          this._viewerPromise = undefined
        }
      })
    }
    return await this._viewerPromise
  }

  private async _createViewer(): Promise<dmv.viewer.VolumeImageViewer> {
    const metadata = await this._client.retrieveSeriesMetadata(
      this._retrieveOptions,
    )
    const candidates: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
    metadata.forEach((m) => {
      const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
        metadata: m as unknown as object,
      })
      const imageFlavor = image.ImageType[2]
      if (imageFlavor === 'VOLUME' || imageFlavor === 'THUMBNAIL') {
        candidates.push(image)
      }
    })
    /*
     * THUMBNAIL instances often use a different frame size than VOLUME pyramid
     * tiles, so pyramid.tileSizes differ across levels. Viv/deck MultiscaleImageLayer
     * expects one tile grid; mixing THUMBNAIL + VOLUME triggers
     * "Inconsistent or non-square tile sizes". Prefer VOLUME only when present.
     */
    const hasVolume = candidates.some((img) => img.ImageType[2] === 'VOLUME')
    const volumeImages = candidates.filter((img) =>
      hasVolume
        ? img.ImageType[2] === 'VOLUME'
        : img.ImageType[2] === 'THUMBNAIL',
    )
    let bitsAllocated: 8 | 16 | undefined
    for (const image of volumeImages) {
      /**
       * Validate bit depth only for instances the viewer will actually use —
       * an unsupported LABEL/OVERVIEW instance must not abort the whole viewer.
       */
      const imageBits = image.BitsAllocated
      if (imageBits !== 8 && imageBits !== 16) {
        throw new Error(
          `Viv path: ${imageBits}-bit pixel data is not supported (only 8 and 16).`,
        )
      }
      if (bitsAllocated === undefined) {
        bitsAllocated = imageBits
      } else if (bitsAllocated !== imageBits) {
        throw new Error(
          'Viv path: mixed 8- and 16-bit instances in one series are not supported.',
        )
      }
    }
    if (volumeImages.length === 0) {
      throw new Error(
        'Viv path: no VOLUME or THUMBNAIL SM instances found for this series.',
      )
    }
    let spp: number | undefined
    for (const image of volumeImages) {
      const imageSpp = image.SamplesPerPixel
      if (spp === undefined) {
        spp = imageSpp
      } else if (spp !== imageSpp) {
        throw new Error(
          'Viv path: mixed SamplesPerPixel values in one series are not supported.',
        )
      }
    }
    if (spp !== 1 && spp !== 3) {
      throw new Error(
        `Viv path: SamplesPerPixel=${String(spp)} is not supported (only 1 and 3).`,
      )
    }
    const viewer = new dmv.viewer.VolumeImageViewer({
      client: this._client,
      metadata: volumeImages,
      controls: [],
    })
    if (this._disposed) {
      /** dispose() ran while metadata was in flight; do not leak the OL map. */
      try {
        viewer.cleanup()
      } catch (err) {
        logger.warn('DicomLoader: VolumeImageViewer.cleanup failed', err)
      }
      throw new Error(
        'DicomLoader: disposed — refusing to rebuild hidden VolumeImageViewer',
      )
    }
    this.bitsAllocated = bitsAllocated
    this.samplesPerPixel = spp
    this._viewer = viewer
    return viewer
  }

  private async _getOpticalPaths(): Promise<{
    [key: string]: OpticalPathEntry
  }> {
    if (this._opticalPaths === undefined) {
      const viewer = await this._getViewer()
      this._opticalPaths = getOpticalPathsMap(viewer)
    }
    return this._opticalPaths
  }

  private async _getTileSize(): Promise<number> {
    if (this._tileSize === undefined) {
      const opticalPaths = await this._getOpticalPaths()
      const pathList = Object.values(opticalPaths)
      if (pathList.length === 0) {
        throw new Error('No tile sizes found in optical paths')
      }
      const ref = pathList[0].pyramid.tileSizes
      if (ref.length === 0) {
        throw new Error('No tile sizes found in optical paths')
      }
      for (let p = 1; p < pathList.length; p++) {
        const ts = pathList[p].pyramid.tileSizes
        if (ts.length !== ref.length) {
          throw new Error(
            'Viv path: optical paths have different pyramid level counts.',
          )
        }
        for (let L = 0; L < ref.length; L++) {
          if (ts[L][0] !== ref[L][0] || ts[L][1] !== ref[L][1]) {
            throw new Error(
              'Viv path: optical paths disagree on tile size at pyramid level ' +
                `${L} ([${ref[L]}] vs [${ts[L]}]).`,
            )
          }
        }
      }
      const perLevel = ref.map(([cols, rows]) => {
        if (cols !== rows) {
          throw new Error(
            'Viv path: non-square tiles (Columns !== Rows) are not supported.',
          )
        }
        return cols
      })
      if (perLevel.some((s) => s !== perLevel[0])) {
        throw new Error(
          'Viv path: tile size varies by pyramid level; only a uniform tile ' +
            'grid is supported.',
        )
      }
      this._tileSize = perLevel[0]
    }
    return this._tileSize
  }

  private async _ensureOrderedPathKeys(): Promise<string[]> {
    if (this._orderedPathKeys === undefined) {
      const opticalPaths = await this._getOpticalPaths()
      const keys = Object.keys(opticalPaths).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      )
      if (keys.length === 0) {
        throw new Error('No optical paths in VolumeImageViewer')
      }
      this._orderedPathKeys = keys
    }
    return this._orderedPathKeys
  }

  /** Map Viv / @vivjs 0-based channel index to dicom-microscopy-viewer optical path id. */
  async resolveOpticalPathId(vivChannelIndex: number): Promise<string> {
    const cached = this._pathIdByChannelIndex.get(vivChannelIndex)
    if (cached !== undefined) {
      return cached
    }
    const keys = await this._ensureOrderedPathKeys()
    const id = keys[vivChannelIndex]
    if (id === undefined) {
      throw new Error(
        `Viv channel index ${vivChannelIndex} is out of range (${keys.length} optical paths: ${keys.join(', ')})`,
      )
    }
    this._pathIdByChannelIndex.set(vivChannelIndex, id)
    return id
  }

  // skipcq: JS-0045 - explicit return undefined at end satisfies linter for async void
  /** One-time warmup of loader refs + decode layout (avoids per-tile async metadata). */
  private async _ensureTileDecodeReady(): Promise<void> {
    if (this._tileDecodeReady !== undefined) {
      return await this._tileDecodeReady
    }
    const ready = (async () => {
      const keys = await this._ensureOrderedPathKeys()
      const first = keys[0]
      if (first !== undefined) {
        await this._getLoader(first)
      }
      await this._getShapes()
      await this._getTileSize()
    })()
    this._tileDecodeReady = ready
    try {
      await ready
    } catch (e) {
      /** Transient warm-up failure must not permanently brick tile loading. */
      if (this._tileDecodeReady === ready) {
        this._tileDecodeReady = undefined
      }
      throw e
    }
    return undefined
  }

  private async _getLoader(
    channel: string,
  ): Promise<(level: number, x: number, y: number) => Promise<ArrayBuffer>> {
    this._ensureVivAbortHooks()
    if (this._loaders === undefined) {
      await this._ensureViewerReadyForTiles()
      const opticalPaths = await this._getOpticalPaths()
      this._loaders = Object.fromEntries(
        Object.entries(opticalPaths).map(([c, p]) => {
          const loader = getDataTileLoader(
            p.layer.getSource() as { loader_?: unknown } | null,
          )
          if (loader === undefined) {
            throw new Error(
              `OpenLayers tile loader missing for optical path "${c}" after render().`,
            )
          }
          return [c, loader]
        }),
      )
      if (!this._openLayersFootprintTrimmed) {
        this._trimOpenLayersFootprint()
        this._openLayersFootprintTrimmed = true
      }
    }
    const loader = this._loaders[channel]
    if (loader === undefined) {
      throw new Error(`No tile loader for channel "${channel}"`)
    }
    return loader
  }

  private async _getShapes(): Promise<
    Array<[number, number, number] | [number, number, number, number]>
  > {
    if (this._shapes === undefined) {
      const opticalPaths = await this._getOpticalPaths()
      const orderedKeys = await this._ensureOrderedPathKeys()
      const first = opticalPaths[orderedKeys[0] ?? '']
      if (first === undefined) {
        throw new Error('No optical paths available for pyramid shapes')
      }
      const spp = this.samplesPerPixel ?? 1
      const sizeC = spp === 3 ? 1 : orderedKeys.length
      const meta = first.pyramid.metadata
      this._columnsByLevel = meta.map((m) => m.Columns)
      this._shapes = meta.map((m) => {
        const sizeY = m.TotalPixelMatrixRows
        const sizeX = m.TotalPixelMatrixColumns
        if (spp === 3) {
          return [1, sizeY, sizeX, 3] as [number, number, number, number]
        }
        return [sizeC, sizeY, sizeX] as [number, number, number]
      })
    }
    return this._shapes
  }

  // skipcq: JS-R1005 - complexity is acceptable for tile decode dispatch logic
  async getTile({
    level,
    channel,
    x,
    y,
    signal,
  }: {
    level: number
    channel: string
    x: number
    y: number
    signal?: AbortSignal
  }): Promise<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }> {
    if (signal?.aborted) {
      throw SIGNAL_ABORTED
    }

    const cacheKey = this._decodedTileCacheKey(level, channel, x, y)
    const cacheGeneration = this._decodedTileCacheGeneration
    const cached = this._decodedTileCache.get(cacheKey)
    if (cached !== undefined) {
      /** Refresh recency (Map insertion order approximates LRU for eviction). */
      this._decodedTileCache.delete(cacheKey)
      this._decodedTileCache.set(cacheKey, cached)
      return {
        data: cached.data,
        width: cached.width,
        height: cached.height,
      }
    }

    if (this._loaders === undefined) {
      await this._ensureTileDecodeReady()
    }
    const loaders = this._loaders
    if (loaders === undefined) {
      throw new Error('DicomLoader: tile loaders not initialized')
    }
    const loader = loaders[channel]
    if (loader === undefined) {
      throw new Error(`No tile loader for channel "${channel}"`)
    }
    const shapes = this._shapes
    const ts = this._tileSize
    const columnsByLevel = this._columnsByLevel
    if (
      shapes === undefined ||
      ts === undefined ||
      columnsByLevel === undefined
    ) {
      throw new Error('DicomLoader: pyramid decode layout not initialized')
    }
    const shape = shapes[level]
    const columns = columnsByLevel[level]
    if (shape === undefined || columns === undefined) {
      throw new Error(`Viv path: missing pyramid metadata for level ${level}`)
    }

    let raw: ArrayBuffer | ArrayBufferView
    try {
      /**
       * OL RGB-8 path returns Uint8Array at runtime; mono often ArrayBuffer/Float32.
       * Loader typings claim only ArrayBuffer — widen so instanceof narrowing works.
       */
      raw = (await invokeOpenLayersLoaderWithAbortSignal(signal, () =>
        loader(level, x, y),
      )) as ArrayBuffer | ArrayBufferView
    } catch (e) {
      const xhr = xhrFromDicomwebErrorDeep(e)
      const tileMeta = xhr !== undefined ? vivXhrTileAbortMeta(xhr) : undefined
      if (xhr !== undefined) {
        clearVivXhrTileAbortMeta(xhr)
      }
      const bridged = tileMeta?.bridgedAbort === true
      const signalPruned = signal?.aborted === true
      const cancelled =
        bridged || signalPruned || isVivDicomTileNetworkCancellation(e)
      /**
       * MultiscaleImageLayer only treats __vivSignalAborted as cancellation; map all
       * deck→dicomweb prune failures to that (see getTileData in @vivjs/layers).
       */
      if (cancelled) {
        throw SIGNAL_ABORTED
      }
      throw e
    }
    const validW = Math.min(ts, shape[2] - x * ts)
    const validH = Math.min(ts, shape[1] - y * ts)
    const spp = this.samplesPerPixel ?? 1
    const bits = this.bitsAllocated ?? 16

    if (spp === 3 && bits === 8) {
      const buf = new Uint8Array(ts * ts * 3)
      buf.fill(255)
      if (!(raw instanceof Uint8Array)) {
        throw new Error(
          'Viv path: expected Uint8Array RGB tile from decoder (check SamplesPerPixel / BitsAllocated).',
        )
      }
      for (let row = 0; row < validH; row++) {
        buf.set(
          raw.subarray(row * columns * 3, row * columns * 3 + validW * 3),
          row * ts * 3,
        )
      }
      const out = { data: buf, width: ts, height: ts }
      this._rememberDecodedTile(cacheKey, out, cacheGeneration)
      return out
    }

    if (spp === 3 && bits === 16) {
      const buf = new Uint16Array(ts * ts * 3)
      buf.fill(65535)
      const src =
        raw instanceof Float32Array
          ? raw
          : raw instanceof ArrayBuffer
            ? new Float32Array(raw)
            : new Float32Array(
                raw.buffer,
                raw.byteOffset,
                raw.byteLength / Float32Array.BYTES_PER_ELEMENT,
              )
      for (let row = 0; row < validH; row++) {
        for (let col = 0; col < validW; col++) {
          const si = (row * columns + col) * 3
          const di = (row * ts + col) * 3
          buf[di] = clampU16(src[si])
          buf[di + 1] = clampU16(src[si + 1])
          buf[di + 2] = clampU16(src[si + 2])
        }
      }
      const out = { data: buf, width: ts, height: ts }
      this._rememberDecodedTile(cacheKey, out, cacheGeneration)
      return out
    }

    const data = monoTileToUint16(raw)
    const cropX = validW
    const cropY = validH
    let yy = 0
    for (; yy < ts; yy++) {
      for (let xx = cropX; xx < ts; xx++) {
        data[yy * ts + xx] = 0
      }
    }
    for (yy = cropY; yy < ts; yy++) {
      for (let xx = 0; xx < cropX; xx++) {
        data[yy * ts + xx] = 0
      }
    }
    const out = { data, width: ts, height: ts }
    this._rememberDecodedTile(cacheKey, out, cacheGeneration)
    return out
  }

  async getSources(): Promise<
    Array<DicomPixelSource | SyntheticDyadicPixelSource>
  > {
    const levelShapes = await this._getShapes()
    const tileSize = await this._getTileSize()
    const spp = this.samplesPerPixel ?? 1
    const bits = this.bitsAllocated ?? 16
    const dtype: 'Uint8' | 'Uint16' =
      spp === 3 && bits === 8 ? 'Uint8' : 'Uint16'
    this._warnIfPyramidStepsMismatchDeckGrid()
    const base = levelShapes.map(
      (shape, i) => new DicomPixelSource(this, i, shape, dtype, tileSize),
    )
    base.reverse()
    await this._ensureTileDecodeReady()
    return insertSyntheticDyadicLevels(base)
  }

  /**
   * Pyramid metadata and affine transforms for Microscopy Bulk Simple Annotations,
   * matching {@link dmv.viewer.VolumeImageViewer} / OpenLayers geometry space.
   */
  async getBulkAnnotationGeometryContext(): Promise<BulkAnnotationGeometryContext> {
    const tViewer0 = vivBulkAnnNow()
    vivBulkAnnDebug(
      'dicomLoader: getBulkAnnotationGeometryContext — _getViewer …',
    )
    const viewer = await this._getViewer()
    vivBulkAnnPerf('dicomLoader:bulk geometry _getViewer', tViewer0, {})
    const tRead0 = vivBulkAnnNow()
    const { metadata, extent } = readVolumeImageViewerPyramid(viewer)
    const affine = readVolumeImageViewerAffine(viewer)
    const affineInverse = readVolumeImageViewerAffineInverse(viewer)
    vivBulkAnnPerf('dicomLoader:bulk geometry pyramid+affine read', tRead0, {
      pyramidLevels: metadata?.length ?? 0,
    })
    return {
      pyramid: metadata,
      affine,
      affineInverse,
      extent,
    }
  }

  /**
   * Deck.gl Tile2D uses a 2× geometric step between each integer tile z. DICOM pyramids often use ~2×,
   * but some (more common on certain 8-bit / RGB encodes) use 3×–4× or irregular factors — then Viv’s
   * multiscale grid no longer lines up with OL tile coordinates and the view “creeps” when zooming.
   */
  private _warnIfPyramidStepsMismatchDeckGrid(): void {
    try {
      const paths = this._opticalPaths
      const keys = this._orderedPathKeys
      if (paths === undefined || keys === undefined || keys.length === 0) {
        return
      }
      const meta = paths[keys[0] ?? '']?.pyramid.metadata
      if (meta === undefined || meta.length < 2) {
        return
      }
      for (let i = 0; i < meta.length - 1; i++) {
        const rw =
          meta[i + 1].TotalPixelMatrixColumns / meta[i].TotalPixelMatrixColumns
        const rh =
          meta[i + 1].TotalPixelMatrixRows / meta[i].TotalPixelMatrixRows
        if (Math.abs(rw - rh) > 0.02) {
          logger.warn(
            '[Viv] Pyramid row/column ratios differ between levels; multiscale alignment may be wrong when zooming.',
          )
          return
        }
        const ratio = rw
        const near2 = Math.abs(ratio - 2) <= 0.12
        const near4 = Math.abs(ratio - 4) <= 0.2
        if (!near2 && !near4) {
          logger.warn(
            `[Viv] Pyramid level step (~${ratio.toFixed(2)}×) is not ~2× between downsamplings. Deck.gl assumes 2× per zoom level; expect offset when switching resolutions.`,
          )
          return
        }
        if (near4) {
          logger.warn(
            '[Viv] ~4× pyramid steps detected; Deck.gl multiscale uses 2× between tile z levels. Zooming may shift the image until tiles match — consider using the OpenLayers viewer for these series.',
          )
          return
        }
      }
    } catch {
      /* ignore */
    }
  }
}

function clampU16(v: number): number {
  if (!Number.isFinite(v)) {
    return 0
  }
  return Math.max(0, Math.min(65535, Math.round(v)))
}

/** Same semantics as previous `new Uint16Array(floatTile)` for decoded mono tiles. */
function monoTileToUint16(raw: ArrayBuffer | ArrayBufferView): Uint16Array {
  if (raw instanceof ArrayBuffer) {
    return new Uint16Array(new Float32Array(raw))
  }
  if (
    raw instanceof Float32Array ||
    raw instanceof Uint16Array ||
    raw instanceof Uint8Array
  ) {
    return new Uint16Array(raw)
  }
  const f32 = new Float32Array(
    raw.buffer,
    raw.byteOffset,
    raw.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )
  return new Uint16Array(f32)
}

/** Half-resolution shape aligned to deck’s 2× tile step (one dyadic level between finer and 4× coarser DICOM). */
function halfShapeForDyadicStep(
  shape: [number, number, number] | [number, number, number, number],
): [number, number, number] | [number, number, number, number] {
  if (shape.length === 4) {
    const [c, h, w] = shape
    return [c, Math.ceil(h / 2), Math.ceil(w / 2), 3]
  }
  const [c, h, w] = shape
  return [c, Math.ceil(h / 2), Math.ceil(w / 2)]
}

/**
 * Deck.gl multiscale assumes ~2× between each `z` step. DICOM often uses one 4× downsampling
 * between instances; without an extra Viv “level” the tile grid shifts on deeper zoom.
 */
/**
 * Viv {@link MultiscaleImageLayer} background {@link ImageLayer} uses one {@link getRaster}
 * call on the coarsest loader. Disabled for synthetic levels or multi-tile pyramids.
 */
export function vivCoarsestLevelSupportsBackgroundRaster(
  sources: Array<DicomPixelSource | SyntheticDyadicPixelSource>,
): boolean {
  if (sources.length === 0) {
    return false
  }
  const coarsest = sources[sources.length - 1]
  if (coarsest instanceof SyntheticDyadicPixelSource) {
    return false
  }
  const rows = coarsest.shape[1]
  const cols = coarsest.shape[2]
  return rows <= coarsest.tileSize && cols <= coarsest.tileSize
}

function insertSyntheticDyadicLevels(
  finestFirst: DicomPixelSource[],
): Array<DicomPixelSource | SyntheticDyadicPixelSource> {
  if (finestFirst.length < 2) {
    return finestFirst
  }
  const out: Array<DicomPixelSource | SyntheticDyadicPixelSource> = []
  let loggedSynthetic = false
  for (let i = 0; i < finestFirst.length; i++) {
    out.push(finestFirst[i])
    if (i + 1 >= finestFirst.length) {
      break
    }
    const wF = finestFirst[i].shape[2]
    const wC = finestFirst[i + 1].shape[2]
    const hF = finestFirst[i].shape[1]
    const hC = finestFirst[i + 1].shape[1]
    const rW = wF / wC
    const rH = hF / hC
    if (Math.abs(rW - rH) > 0.02) {
      continue
    }
    const ratio = rW
    if (ratio > 3.5 && ratio < 4.5) {
      if (!loggedSynthetic) {
        logger.log(
          '[Viv] Inserting synthetic half-resolution pyramid level(s) (DICOM ~4× step) so deck.gl 2× tile alignment matches OpenLayers.',
        )
        loggedSynthetic = true
      }
      out.push(
        new SyntheticDyadicPixelSource(
          finestFirst[i].loader,
          finestFirst[i].dicomLevel,
          halfShapeForDyadicStep(finestFirst[i].shape),
          finestFirst[i].dtype,
          finestFirst[i].tileSize,
          finestFirst[i].shape,
        ),
      )
    }
  }
  return out
}

export class DicomPixelSource {
  private readonly _loader: DicomLoader

  private readonly _level: number

  /** OpenLayers / dicom-microscopy-viewer pyramid index (0 = coarsest, N-1 = finest). */
  get dicomLevel(): number {
    return this._level
  }

  get loader(): DicomLoader {
    return this._loader
  }

  labels = ['c', 'y', 'x']

  shape: [number, number, number] | [number, number, number, number]

  dtype: 'Uint8' | 'Uint16'

  tileSize: number

  /**
   * Interleaved RGB tiles use BitmapLayer, which reads `photometricInterpretation` from `meta`.
   * @vivjs defaults to 2 when unset on ImageLayer; MultiscaleImageLayer still destructures `meta` and requires a non-null object.
   */
  meta: { photometricInterpretation: number } | null

  constructor(
    loader: DicomLoader,
    level: number,
    shape: [number, number, number] | [number, number, number, number],
    dtype: 'Uint8' | 'Uint16',
    tileSize: number,
  ) {
    this._loader = loader
    this._level = level
    this.shape = shape
    this.dtype = dtype
    this.tileSize = tileSize
    this.meta = shape.length === 4 ? { photometricInterpretation: 2 } : null
  }

  async getRaster({
    selection,
    signal,
  }: {
    selection: { c: number; t: number; z: number }
    signal?: AbortSignal
  }): Promise<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }> {
    const rows = this.shape[1]
    const cols = this.shape[2]
    if (rows > this.tileSize || cols > this.tileSize) {
      throw new Error('getRaster not supported for multi-tile pyramid levels')
    }
    return await this.getTile({ x: 0, y: 0, selection, signal })
  }

  async getTile({
    x,
    y,
    selection,
    signal,
  }: {
    x: number
    y: number
    selection: { c: number; t: number; z: number }
    signal?: AbortSignal
  }): Promise<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }> {
    const pathId = await this._loader.resolveOpticalPathId(selection.c)
    return await this._loader.getTile({
      level: this._level,
      channel: pathId,
      x,
      y,
      signal,
    })
  }

  // skipcq: JS-0105 - method kept as instance for Viv PixelSource interface compliance
  onTileError(err: Error): void {
    logger.error(`Tile error: ${err}`)
  }
}

/**
 * Viv level whose pixel grid is ~2× coarser than `finerDicomLevel` but still uses that
 * DICOM instance by merging 2×2 native tiles and box-downsampling to `tileSize`.
 */
export class SyntheticDyadicPixelSource {
  private readonly _loader: DicomLoader

  private readonly _finerDicomLevel: number

  /**
   * Pixel shape of the finer DICOM level backing this synthetic level; used to
   * clamp 2×2 quadrant fetches so odd tile grids never request tiles past the
   * finer grid's right/bottom edge (DMV would warn and pollute the tile cache).
   */
  private readonly _finerShape?:
    | [number, number, number]
    | [number, number, number, number]

  labels = ['c', 'y', 'x']

  shape: [number, number, number] | [number, number, number, number]

  dtype: 'Uint8' | 'Uint16'

  tileSize: number

  meta: { photometricInterpretation: number } | null

  constructor(
    loader: DicomLoader,
    finerDicomLevel: number,
    shape: [number, number, number] | [number, number, number, number],
    dtype: 'Uint8' | 'Uint16',
    tileSize: number,
    finerShape?: [number, number, number] | [number, number, number, number],
  ) {
    this._loader = loader
    this._finerDicomLevel = finerDicomLevel
    this.shape = shape
    this.dtype = dtype
    this.tileSize = tileSize
    this._finerShape = finerShape
    this.meta = shape.length === 4 ? { photometricInterpretation: 2 } : null
  }

  get loader(): DicomLoader {
    return this._loader
  }

  get dicomLevel(): number {
    return this._finerDicomLevel
  }

  // skipcq: JS-0105, JS-0116 - instance method for interface compliance
  getRaster(): Promise<never> {
    return Promise.reject(
      new Error('getRaster not supported for synthetic pyramid levels'),
    )
  }

  async getTile({
    x,
    y,
    selection,
    signal,
  }: {
    x: number
    y: number
    selection: { c: number; t: number; z: number }
    signal?: AbortSignal
  }): Promise<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }> {
    const pathId = await this._loader.resolveOpticalPathId(selection.c)
    const lx = 2 * x
    const ly = 2 * y
    /**
     * On odd finer-level tile grids the `+1` quadrant would index past the grid
     * (DMV "could not load tile … does not exist" warning + wasted decode).
     * Substitute a locally generated fill tile for out-of-range quadrants.
     */
    const finerShape = this._finerShape
    const finerTilesX =
      finerShape !== undefined
        ? Math.ceil(finerShape[2] / this.tileSize)
        : Number.POSITIVE_INFINITY
    const finerTilesY =
      finerShape !== undefined
        ? Math.ceil(finerShape[1] / this.tileSize)
        : Number.POSITIVE_INFINITY
    const fetchQuadrant = async (
      qx: number,
      qy: number,
    ): Promise<{
      data: Uint8Array | Uint16Array
      width: number
      height: number
    }> => {
      if (qx >= finerTilesX || qy >= finerTilesY) {
        return this._makeFillTile()
      }
      return await this._loader.getTile({
        level: this._finerDicomLevel,
        channel: pathId,
        x: qx,
        y: qy,
        signal,
      })
    }
    let tiles: Array<{
      data: Uint8Array | Uint16Array
      width: number
      height: number
    }>
    try {
      tiles = await Promise.all([
        fetchQuadrant(lx, ly),
        fetchQuadrant(lx + 1, ly),
        fetchQuadrant(lx, ly + 1),
        fetchQuadrant(lx + 1, ly + 1),
      ])
    } catch (e) {
      if (
        e === SIGNAL_ABORTED ||
        signal?.aborted === true ||
        isVivDicomTileNetworkCancellation(e)
      ) {
        throw SIGNAL_ABORTED
      }
      throw e
    }
    return downsampleFourQuadrants(tiles, this.tileSize, this.dtype, this.shape)
  }

  /** Fill values match the empty-quadrant synthesis in {@link downsampleFourQuadrants}. */
  private _makeFillTile(): {
    data: Uint8Array | Uint16Array
    width: number
    height: number
  } {
    const interleaved = this.shape.length === 4
    const ch = interleaved ? 3 : 1
    const n = this.tileSize * this.tileSize * ch
    if (this.dtype === 'Uint8') {
      const data = new Uint8Array(n)
      data.fill(255)
      return { data, width: this.tileSize, height: this.tileSize }
    }
    const data = new Uint16Array(n)
    data.fill(interleaved ? 65535 : 0)
    return { data, width: this.tileSize, height: this.tileSize }
  }

  // skipcq: JS-0105 - method kept as instance for Viv PixelSource interface compliance
  onTileError(err: Error): void {
    logger.error(`Tile error: ${err}`)
  }
}

function downsampleFourQuadrants(
  tiles: Array<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }>,
  ts: number,
  dtype: 'Uint8' | 'Uint16',
  shape: [number, number, number] | [number, number, number, number],
): {
  data: Uint8Array | Uint16Array
  width: number
  height: number
} {
  const bigW = ts * 2
  const bigH = ts * 2
  const interleaved = shape.length === 4
  const ch = interleaved ? 3 : 1

  if (dtype === 'Uint8' && interleaved) {
    const big = new Uint8Array(bigW * bigH * 3)
    big.fill(255)
    blitTileQuadrant(big, bigW, tiles[0], 0, 0, ts, ch)
    blitTileQuadrant(big, bigW, tiles[1], ts, 0, ts, ch)
    blitTileQuadrant(big, bigW, tiles[2], 0, ts, ts, ch)
    blitTileQuadrant(big, bigW, tiles[3], ts, ts, ts, ch)
    const out = new Uint8Array(ts * ts * 3)
    out.fill(255)
    boxDownsampleRgb8(big, bigW, bigH, out, ts)
    return { data: out, width: ts, height: ts }
  }

  if (dtype === 'Uint16' && interleaved) {
    const big = new Uint16Array(bigW * bigH * 3)
    big.fill(65535)
    blitTileQuadrantU16(big, bigW, tiles[0], 0, 0, ts, ch)
    blitTileQuadrantU16(big, bigW, tiles[1], ts, 0, ts, ch)
    blitTileQuadrantU16(big, bigW, tiles[2], 0, ts, ts, ch)
    blitTileQuadrantU16(big, bigW, tiles[3], ts, ts, ts, ch)
    const out = new Uint16Array(ts * ts * 3)
    out.fill(65535)
    boxDownsampleRgb16(big, bigW, bigH, out, ts)
    return { data: out, width: ts, height: ts }
  }

  const big = new Uint16Array(bigW * bigH)
  big.fill(0)
  blitMonoQuadrant(big, bigW, tiles[0], 0, 0, ts)
  blitMonoQuadrant(big, bigW, tiles[1], ts, 0, ts)
  blitMonoQuadrant(big, bigW, tiles[2], 0, ts, ts)
  blitMonoQuadrant(big, bigW, tiles[3], ts, ts, ts)
  const out = new Uint16Array(ts * ts)
  boxDownsampleMono16(big, bigW, bigH, out, ts)
  return { data: out, width: ts, height: ts }
}

function blitTileQuadrant(
  dst: Uint8Array,
  dstStride: number,
  tile: { data: Uint8Array | Uint16Array; width: number; height: number },
  ox: number,
  oy: number,
  ts: number,
  ch: number,
): void {
  const src = tile.data as Uint8Array
  for (let row = 0; row < tile.height; row++) {
    for (let col = 0; col < tile.width; col++) {
      const si = (row * ts + col) * ch
      const di = ((oy + row) * dstStride + (ox + col)) * ch
      for (let k = 0; k < ch; k++) {
        dst[di + k] = src[si + k]
      }
    }
  }
}

function blitTileQuadrantU16(
  dst: Uint16Array,
  dstStride: number,
  tile: { data: Uint8Array | Uint16Array; width: number; height: number },
  ox: number,
  oy: number,
  ts: number,
  ch: number,
): void {
  const src = tile.data as Uint16Array
  for (let row = 0; row < tile.height; row++) {
    for (let col = 0; col < tile.width; col++) {
      const si = (row * ts + col) * ch
      const di = ((oy + row) * dstStride + (ox + col)) * ch
      for (let k = 0; k < ch; k++) {
        dst[di + k] = src[si + k]
      }
    }
  }
}

function blitMonoQuadrant(
  dst: Uint16Array,
  dstStride: number,
  tile: { data: Uint8Array | Uint16Array; width: number; height: number },
  ox: number,
  oy: number,
  ts: number,
): void {
  const src = tile.data as Uint16Array
  for (let row = 0; row < tile.height; row++) {
    for (let col = 0; col < tile.width; col++) {
      dst[(oy + row) * dstStride + (ox + col)] = src[row * ts + col]
    }
  }
}

function boxDownsampleRgb8(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dst: Uint8Array,
  dstTs: number,
): void {
  for (let dy = 0; dy < dstTs; dy++) {
    for (let dx = 0; dx < dstTs; dx++) {
      for (let k = 0; k < 3; k++) {
        let sum = 0
        let n = 0
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            const sy = dy * 2 + j
            const sx = dx * 2 + i
            if (sy < srcH && sx < srcW) {
              sum += src[(sy * srcW + sx) * 3 + k]
              n++
            }
          }
        }
        dst[(dy * dstTs + dx) * 3 + k] = n > 0 ? Math.round(sum / n) & 255 : 255
      }
    }
  }
}

function boxDownsampleRgb16(
  src: Uint16Array,
  srcW: number,
  srcH: number,
  dst: Uint16Array,
  dstTs: number,
): void {
  for (let dy = 0; dy < dstTs; dy++) {
    for (let dx = 0; dx < dstTs; dx++) {
      for (let k = 0; k < 3; k++) {
        let sum = 0
        let n = 0
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            const sy = dy * 2 + j
            const sx = dx * 2 + i
            if (sy < srcH && sx < srcW) {
              sum += src[(sy * srcW + sx) * 3 + k]
              n++
            }
          }
        }
        dst[(dy * dstTs + dx) * 3 + k] = n > 0 ? clampU16(sum / n) : 65535
      }
    }
  }
}

function boxDownsampleMono16(
  src: Uint16Array,
  srcW: number,
  srcH: number,
  dst: Uint16Array,
  dstTs: number,
): void {
  for (let dy = 0; dy < dstTs; dy++) {
    for (let dx = 0; dx < dstTs; dx++) {
      let sum = 0
      let n = 0
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const sy = dy * 2 + j
          const sx = dx * 2 + i
          if (sy < srcH && sx < srcW) {
            sum += src[sy * srcW + sx]
            n++
          }
        }
      }
      dst[dy * dstTs + dx] = n > 0 ? clampU16(sum / n) : 0
    }
  }
}

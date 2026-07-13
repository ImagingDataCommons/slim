/**
 * Streaming retrieval of bulk Microscopy Simple Annotation coordinate data.
 *
 * Background
 * ----------
 * `dicomweb-client.retrieveBulkData` uses `XMLHttpRequest` with
 * `responseType = 'arraybuffer'`, so the whole bulk blob (often hundreds of MB
 * for whole-slide polygon groups) is buffered before the promise resolves — and
 * for `multipart/related` responses, decoded only at the very end. Nothing can
 * render until the full download completes.
 *
 * DICOM Microscopy Bulk Simple Annotations store coordinates as one flat buffer
 * (`PointCoordinatesData` / `DoublePointCoordinatesData`) plus a
 * `LongPrimitivePointIndexList` (`graphicIndex`) giving the 1-based start offset
 * of each annotation's first coordinate. In standard encodings the index is
 * monotonically increasing, so annotation `k`'s bytes live entirely in the
 * prefix `[0 … end_k)` of the coordinate buffer. That means: once we have the
 * (small) index, we can decode every annotation whose last coordinate has
 * already arrived, *while the rest of the buffer is still downloading*.
 *
 * This module fetches the coordinate bulk data with `fetch()` +
 * `ReadableStream` and reports growing, element-aligned prefixes so the caller
 * can decode + render annotations incrementally. It transparently handles the
 * `multipart/related` envelope DICOMweb servers (e.g. Google Healthcare) wrap
 * the payload in, and falls back cleanly to single-part (`application/octet-stream`)
 * responses.
 *
 * Anything unexpected (no `ReadableStream`, non-2xx, non-monotonic index,
 * unsupported VR, abort) is surfaced so the caller can fall back to the classic
 * monolithic `dmv.annotation.fetchGraphicData` path with no behavioural change.
 */

import { vivBulkAnnDebug } from './vivBulkAnnDebug'

/** Coordinate buffer element kinds we can stream-decode (4-byte VRs only). */
type StreamableBulkKind = 'int32' | 'float32'

export type StreamableBulkGraphicArray = Int32Array | Float32Array

type StreamableVrInfo = {
  elementByteSize: number
  kind: StreamableBulkKind
}

/**
 * Only 4-byte coordinate VRs are streamed here so decoded prefixes match the
 * `Int32Array | Float32Array` typed-array contract the Deck decode path already
 * expects. `OD`/`OV` (8-byte) groups fall back to the monolithic retrieve.
 */
export function getStreamableBulkVrInfo(vr: string): StreamableVrInfo | null {
  switch (vr) {
    case 'OL':
      return { elementByteSize: 4, kind: 'int32' }
    case 'OF':
      return { elementByteSize: 4, kind: 'float32' }
    default:
      return null
  }
}

function makeGraphicDataView(
  kind: StreamableBulkKind,
  buffer: ArrayBuffer,
  elementCount: number,
): StreamableBulkGraphicArray {
  return kind === 'int32'
    ? new Int32Array(buffer, 0, elementCount)
    : new Float32Array(buffer, 0, elementCount)
}

/** DICOM JSON bulk data reference (`{ vr, BulkDataURI }`). */
export type BulkDataReference = {
  vr?: string
  BulkDataURI?: string
}

/**
 * Resolve the coordinate-data bulk reference for an annotation group, returning
 * `null` when the data is inline in the metadata or only retrievable from P10
 * (those keep the existing non-streaming code path).
 */
export function resolveStreamableGraphicDataReference(options: {
  metadataItem: Record<string, unknown> | object
  bulkdataItem: Record<string, unknown> | object | undefined
}): BulkDataReference | null {
  const metadataItem = options.metadataItem as Record<string, unknown>
  const bulkdataItem = options.bulkdataItem as
    | Record<string, unknown>
    | undefined
  // Inline coordinates: nothing to stream.
  if (
    'PointCoordinatesData' in metadataItem ||
    'DoublePointCoordinatesData' in metadataItem
  ) {
    return null
  }
  if (bulkdataItem == null) {
    return null
  }
  const pointRef = bulkdataItem.PointCoordinatesData as
    | BulkDataReference
    | undefined
  const doubleRef = bulkdataItem.DoublePointCoordinatesData as
    | BulkDataReference
    | undefined
  const ref = pointRef ?? doubleRef
  if (
    ref == null ||
    typeof ref.BulkDataURI !== 'string' ||
    ref.BulkDataURI.length === 0
  ) {
    return null
  }
  // DICOM JSON sometimes omits `vr` on BulkDataURI stubs. Infer the standard VR
  // so streaming isn't silently disabled (empty vr → monolithic fallback).
  if (ref.vr == null || ref.vr === '') {
    return {
      ...ref,
      vr: pointRef != null ? 'OL' : 'OD',
    }
  }
  return ref
}

/** `graphicIndex` must be non-decreasing for prefix decode to be valid. */
export function isMonotonicGraphicIndex(
  graphicIndex: Int32Array,
  numberOfAnnotations: number,
): boolean {
  const n = Math.min(numberOfAnnotations, graphicIndex.length)
  let prev = -Infinity
  for (let i = 0; i < n; i++) {
    const v = Number(graphicIndex[i])
    if (v < prev) {
      return false
    }
    prev = v
  }
  return true
}

/** Whether streaming hydrate is even possible in this environment. */
export function browserSupportsBulkStreaming(): boolean {
  return (
    typeof fetch === 'function' &&
    typeof ReadableStream === 'function' &&
    typeof AbortController === 'function'
  )
}

function extractMultipartBoundary(contentType: string): string | null {
  if (contentType.indexOf('multipart') === -1) {
    return null
  }
  const match = /boundary=(?:"([^"]+)"|([^;,\s]+))/i.exec(contentType)
  if (match == null) {
    return null
  }
  return match[1] ?? match[2] ?? null
}

/** ASCII bytes for a string (boundary / CRLF markers are ASCII). */
function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    out[i] = s.charCodeAt(i) & 0xff
  }
  return out
}

/** Index of `needle` within `haystack[0..hayLen)`, or -1. */
function indexOfSubarray(
  haystack: Uint8Array,
  hayLen: number,
  needle: Uint8Array,
  fromIndex: number,
): number {
  const needleLen = needle.length
  if (needleLen === 0) {
    return fromIndex
  }
  const last = hayLen - needleLen
  for (let i = Math.max(0, fromIndex); i <= last; i++) {
    let j = 0
    while (j < needleLen && haystack[i + j] === needle[j]) {
      j++
    }
    if (j === needleLen) {
      return i
    }
  }
  return -1
}

/** Last index of `needle` within `haystack[0..hayLen)`, or -1. */
function lastIndexOfSubarray(
  haystack: Uint8Array,
  hayLen: number,
  needle: Uint8Array,
): number {
  const needleLen = needle.length
  for (let i = hayLen - needleLen; i >= 0; i--) {
    let j = 0
    while (j < needleLen && haystack[i + j] === needle[j]) {
      j++
    }
    if (j === needleLen) {
      return i
    }
  }
  return -1
}

export type BulkPrefixInfo = {
  /** Element-aligned view of the coordinate prefix decoded so far. */
  graphicData: StreamableBulkGraphicArray
  /** Inclusive index of the last annotation fully present in `graphicData` (-1 if none). */
  completeThroughIndex: number
  /** Coordinate elements available in `graphicData`. */
  availableElementCount: number
  /** Total bytes received from the network so far (whole response, incl. envelope). */
  loadedBytes: number
  /** `Content-Length` of the whole response if the server provided it. */
  totalBytes: number | null
  /** True on the final callback, when `graphicData` is the complete buffer. */
  done: boolean
}

/**
 * Subset of `DicomWebManager.retrieveBulkData` used for progressive Range GETs.
 * Same XHR + CORS path as graphicIndex / tiles — unlike raw `fetch` + Range.
 */
export type BulkDataRangeRetriever = (options: {
  BulkDataURI: string
  mediaTypes?: Array<{ mediaType: string; transferSyntaxUID?: string }>
  byteRange?: [number, number]
}) => Promise<ArrayBuffer[]>

export type StreamBulkGraphicDataOptions = {
  /** Absolute or relative `BulkDataURI`. */
  url: string
  /** Base URL used to resolve a relative `BulkDataURI`. */
  baseUrl?: string
  /** Auth + other headers (e.g. `Authorization: Bearer …`). */
  headers: Record<string, string>
  vr: string
  graphicIndex: Int32Array
  numberOfAnnotations: number
  signal?: AbortSignal
  /**
   * Preferred progressive path: sequential `byteRange` retrieves through
   * dicomweb-client XHR. This is what actually paints mid-transfer against
   * IDC/GCP proxies that buffer a full multipart GET.
   */
  retrieveBulkData?: BulkDataRangeRetriever
  /**
   * Fetch credentials mode. Default `omit` matches dicomweb-client XHR (`withCredentials`
   * false). Do not use `include` against IDC/GCP proxies — it triggers a CORS preflight
   * that fails unless the server sends `Access-Control-Allow-Credentials: true`.
   */
  credentials?: RequestCredentials
  /** Network progress (whole-response bytes). */
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
  /** Newly-available, element-aligned coordinate prefix (throttled). */
  onPrefix?: (info: BulkPrefixInfo) => void | Promise<void>
  /** Emit a prefix at most this often by payload bytes (default 128 KiB). */
  prefixThrottleBytes?: number
  /**
   * Also emit when this many additional annotations become fully decodable
   * (default 2_000). Keeps paint moving when the browser delivers one large
   * read at the end of a fast download.
   */
  prefixEmitAnnotationStep?: number
  /**
   * HTTP Range chunk size for progressive retrieve (default 1 MiB).
   * Smaller → more frequent paints; larger → fewer round-trips.
   */
  rangeChunkBytes?: number
  /**
   * Use raw `fetch` + Range (separate from {@link retrieveBulkData}). Default
   * false — enable with `localStorage.slim:vivBulkRange=1` only for debugging.
   */
  preferByteRange?: boolean
}

async function yieldToBrowser(): Promise<void> {
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
}

/** Own a tightly-sized buffer so TypedArray views cover only payload bytes. */
function ownedPayloadBytes(src: Uint8Array): Uint8Array {
  if (src.byteOffset === 0 && src.byteLength === src.buffer.byteLength) {
    return src
  }
  const copy = new Uint8Array(src.byteLength)
  copy.set(src)
  return copy
}

/**
 * When the server ignores Range and returns the whole bulk object in one shot,
 * do not discard it for a second full GET. Walk the buffered payload and emit
 * `onPrefix` in annotation steps so Deck can paint between yields.
 *
 * This is still *post-transfer* progressive paint (bytes are already local), but
 * mid-transfer Range paint is impossible when the origin ignores Range.
 */
async function paintProgressiveFromCompletePayload(options: {
  payload: Uint8Array
  kind: StreamableBulkKind
  elementByteSize: number
  numberOfAnnotations: number
  prefixEmitAnnotationStep: number
  signal?: AbortSignal
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
  onPrefix?: (info: BulkPrefixInfo) => void | Promise<void>
  route: string
}): Promise<StreamableBulkGraphicArray> {
  const {
    kind,
    elementByteSize,
    numberOfAnnotations,
    prefixEmitAnnotationStep,
    signal,
    onProgress,
    onPrefix,
    route,
  } = options
  const owned = ownedPayloadBytes(options.payload)
  const loadedBytes = owned.byteLength
  onProgress?.(loadedBytes, loadedBytes)

  const finalElementCount = Math.floor(loadedBytes / elementByteSize)
  const finalView = makeGraphicDataView(kind, owned.buffer, finalElementCount)

  if (onPrefix == null || numberOfAnnotations <= 0) {
    vivBulkAnnDebug('bulkStream:done', {
      route,
      loadedBytes,
      finalElementCount,
      numberOfAnnotations,
      progressivePrefixEmits: 0,
    })
    return finalView
  }

  const step = Math.max(1, Math.min(prefixEmitAnnotationStep, 2_000))
  let emitCount = 0
  for (
    let through = Math.min(step - 1, numberOfAnnotations - 1);
    through < numberOfAnnotations - 1;
    through = Math.min(through + step, numberOfAnnotations - 1)
  ) {
    if (signal?.aborted === true) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    // `done: false` so hydrate's onPrefix paints (it skips done:true prefixes).
    await onPrefix({
      graphicData: finalView,
      completeThroughIndex: through,
      availableElementCount: finalElementCount,
      loadedBytes,
      totalBytes: loadedBytes,
      done: false,
    })
    emitCount++
    console.info(
      `[Viv bulk] progressive paint: annotations through ${through + 1}/${numberOfAnnotations} (buffered ${(loadedBytes / (1024 * 1024)).toFixed(1)} MB)`,
    )
    await yieldToBrowser()
    if (through >= numberOfAnnotations - 1) {
      break
    }
  }

  // Final prefix still `done: false` so the last decode batch paints via onPrefix.
  if (signal?.aborted === true) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  await onPrefix({
    graphicData: finalView,
    completeThroughIndex: numberOfAnnotations - 1,
    availableElementCount: finalElementCount,
    loadedBytes,
    totalBytes: loadedBytes,
    done: false,
  })
  emitCount++
  console.info(
    `[Viv bulk] progressive paint: annotations through ${numberOfAnnotations}/${numberOfAnnotations} (buffered ${(loadedBytes / (1024 * 1024)).toFixed(1)} MB)`,
  )
  await yieldToBrowser()

  vivBulkAnnDebug('bulkStream:done', {
    route,
    loadedBytes,
    finalElementCount,
    numberOfAnnotations,
    progressivePrefixEmits: emitCount,
  })
  return finalView
}

/**
 * Stream the coordinate bulk data, invoking `onPrefix` with growing,
 * element-aligned prefixes as bytes arrive, and resolving with the complete
 * coordinate typed array.
 *
 * Progressive paint against IDC/GCP requires **Range retrieves**, not a single
 * multipart GET: those proxies typically buffer the full body before the browser
 * sees any bytes. Preferred path: sequential `byteRange` via dicomweb-client
 * XHR (same CORS stack as graphicIndex). Falls back to a full multipart stream.
 */
export async function streamBulkGraphicData(
  options: StreamBulkGraphicDataOptions,
): Promise<StreamableBulkGraphicArray> {
  const {
    url,
    baseUrl,
    headers,
    vr,
    graphicIndex,
    numberOfAnnotations,
    signal,
    onProgress,
    onPrefix,
    credentials,
    retrieveBulkData,
  } = options
  const vrInfo = getStreamableBulkVrInfo(vr)
  if (vrInfo == null) {
    throw new Error(`bulk streaming unsupported for VR "${vr}"`)
  }
  const { elementByteSize, kind } = vrInfo
  const prefixThrottleBytes = options.prefixThrottleBytes ?? 128 * 1024
  const prefixEmitAnnotationStep = options.prefixEmitAnnotationStep ?? 2_000
  const rangeChunkBytes = options.rangeChunkBytes ?? 1 * 1024 * 1024

  const resolvedUrl =
    baseUrl != null && baseUrl.length > 0
      ? new URL(url, baseUrl).toString()
      : url
  const requestCredentials = credentials ?? 'omit'

  if (retrieveBulkData != null) {
    try {
      const viaClient = await streamBulkGraphicDataViaClientRanges({
        BulkDataURI: resolvedUrl,
        retrieveBulkData,
        kind,
        elementByteSize,
        graphicIndex,
        numberOfAnnotations,
        rangeChunkBytes,
        prefixThrottleBytes,
        prefixEmitAnnotationStep,
        signal,
        onProgress,
        onPrefix,
      })
      if (viaClient != null) {
        return viaClient
      }
    } catch (e) {
      if (signal?.aborted === true) {
        throw e
      }
      vivBulkAnnDebug('bulkStream:client Range failed; trying full GET', {
        err: e instanceof Error ? e.message : String(e),
      })
      console.warn(
        '[Viv bulk] Range progressive retrieve failed; falling back to full GET (paint after download).',
        e,
      )
    }
  }

  let preferFetchRange = options.preferByteRange === true
  if (options.preferByteRange == null) {
    try {
      preferFetchRange =
        typeof window !== 'undefined' &&
        window.localStorage?.getItem('slim:vivBulkRange') === '1'
    } catch {
      preferFetchRange = false
    }
  }

  if (preferFetchRange) {
    try {
      const ranged = await tryStreamBulkGraphicDataViaRanges({
        resolvedUrl,
        headers,
        credentials: requestCredentials,
        signal,
        kind,
        elementByteSize,
        graphicIndex,
        numberOfAnnotations,
        rangeChunkBytes,
        prefixThrottleBytes,
        prefixEmitAnnotationStep,
        onProgress,
        onPrefix,
      })
      if (ranged != null) {
        return ranged
      }
    } catch (e) {
      if (signal?.aborted === true) {
        throw e
      }
      vivBulkAnnDebug('bulkStream:fetch Range probe failed; using full GET', {
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return await streamBulkGraphicDataFullGet({
    resolvedUrl,
    headers,
    credentials: requestCredentials,
    signal,
    kind,
    elementByteSize,
    graphicIndex,
    numberOfAnnotations,
    prefixThrottleBytes,
    prefixEmitAnnotationStep,
    onProgress,
    onPrefix,
  })
}

function partToUint8(part: ArrayBuffer | Uint8Array): Uint8Array {
  if (part instanceof Uint8Array) {
    return part
  }
  return new Uint8Array(part)
}

/**
 * Progressive retrieve via dicomweb-client `byteRange` XHR.
 *
 * Returns `null` when the server ignores Range (first response ≫ chunk size)
 * so the caller can fall back to a full GET. Throws on hard failures.
 */
async function streamBulkGraphicDataViaClientRanges(options: {
  BulkDataURI: string
  retrieveBulkData: BulkDataRangeRetriever
  kind: StreamableBulkKind
  elementByteSize: number
  graphicIndex: Int32Array
  numberOfAnnotations: number
  rangeChunkBytes: number
  prefixThrottleBytes: number
  prefixEmitAnnotationStep: number
  signal?: AbortSignal
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
  onPrefix?: (info: BulkPrefixInfo) => void | Promise<void>
}): Promise<StreamableBulkGraphicArray | null> {
  const {
    BulkDataURI,
    retrieveBulkData,
    kind,
    elementByteSize,
    graphicIndex,
    numberOfAnnotations,
    rangeChunkBytes,
    prefixThrottleBytes,
    prefixEmitAnnotationStep,
    signal,
    onProgress,
    onPrefix,
  } = options

  const firstEnd = Math.max(0, rangeChunkBytes - 1)
  const firstParts = await retrieveBulkData({
    BulkDataURI,
    // dicomweb-client expects `{ mediaType }` objects, not bare strings.
    mediaTypes: [{ mediaType: 'application/octet-stream' }],
    byteRange: [0, firstEnd],
  })
  if (signal?.aborted === true) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  if (firstParts.length === 0 || firstParts[0] == null) {
    throw new Error('bulk range: empty first part')
  }
  const firstChunk = partToUint8(firstParts[0])

  // Server ignored Range and returned the whole bulk object in one shot.
  // Use that buffer for progressive decode/paint — do not discard and re-GET.
  if (firstChunk.byteLength > rangeChunkBytes * 2) {
    vivBulkAnnDebug('bulkStream:client Range ignored (oversized first part)', {
      firstBytes: firstChunk.byteLength,
      rangeChunkBytes,
    })
    console.warn(
      '[Viv bulk] server ignored HTTP Range (got full body in one response). Mid-transfer paint needs proxy Range support; painting progressively from the buffered payload instead of re-downloading.',
      { firstBytes: firstChunk.byteLength, rangeChunkBytes },
    )
    return await paintProgressiveFromCompletePayload({
      payload: firstChunk,
      kind,
      elementByteSize,
      numberOfAnnotations,
      prefixEmitAnnotationStep,
      signal,
      onProgress,
      onPrefix,
      route: 'client-range-ignored-buffered',
    })
  }

  let payload = new Uint8Array(
    Math.max(rangeChunkBytes * 4, firstChunk.byteLength),
  )
  let payloadLen = 0
  let loadedBytes = 0
  let completeThroughIndex = -1
  let lastPrefixPayloadLen = 0
  let lastPrefixEmittedThrough = -1
  let rangeIndex = 0

  const ensureCapacity = (extra: number): void => {
    const needed = payloadLen + extra
    if (needed <= payload.length) {
      return
    }
    let next = payload.length * 2
    while (next < needed) {
      next *= 2
    }
    const grown = new Uint8Array(next)
    grown.set(payload.subarray(0, payloadLen))
    payload = grown
  }

  const pushBytes = (chunk: Uint8Array): void => {
    if (chunk.length === 0) {
      return
    }
    ensureCapacity(chunk.length)
    payload.set(chunk, payloadLen)
    payloadLen += chunk.length
    loadedBytes += chunk.length
    onProgress?.(loadedBytes, null)
  }

  const elementsAvailable = (): number =>
    Math.floor(payloadLen / elementByteSize)

  const advanceCompleteThrough = (
    availableElements: number,
    done: boolean,
  ): number => {
    const n = numberOfAnnotations
    let i = completeThroughIndex
    while (i + 1 < n) {
      const next = i + 1
      const endElement =
        next + 1 < n
          ? Number(graphicIndex[next + 1]) - 1
          : done
            ? availableElements
            : Number.POSITIVE_INFINITY
      if (endElement <= availableElements) {
        i = next
      } else {
        break
      }
    }
    completeThroughIndex = i
    return i
  }

  const emitPrefixNow = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    const availableElements = elementsAvailable()
    const throughIndex = advanceCompleteThrough(availableElements, done)
    if (!done && throughIndex < 0 && availableElements === 0) {
      return
    }
    const emitThrough = done
      ? throughIndex
      : Math.min(
          throughIndex,
          lastPrefixEmittedThrough + prefixEmitAnnotationStep,
        )
    if (!done && emitThrough <= lastPrefixEmittedThrough) {
      return
    }
    lastPrefixPayloadLen = payloadLen
    await onPrefix({
      graphicData: makeGraphicDataView(kind, payload.buffer, availableElements),
      completeThroughIndex: emitThrough,
      availableElementCount: availableElements,
      loadedBytes,
      totalBytes: null,
      done,
    })
    lastPrefixEmittedThrough = Math.max(lastPrefixEmittedThrough, emitThrough)
    console.info(
      `[Viv bulk] progressive paint: annotations through ${emitThrough + 1}/${numberOfAnnotations} (${(loadedBytes / (1024 * 1024)).toFixed(1)} MB retrieved)`,
    )
    await yieldToBrowser()
  }

  const drainDecodablePrefixes = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    for (;;) {
      const availableElements = elementsAvailable()
      const beforeThrough = completeThroughIndex
      advanceCompleteThrough(availableElements, done)
      const byteDelta = payloadLen - lastPrefixPayloadLen
      const firstAnnotationReady =
        lastPrefixEmittedThrough < 0 && completeThroughIndex >= 0
      const annotationsReady =
        completeThroughIndex - lastPrefixEmittedThrough >=
        prefixEmitAnnotationStep
      const shouldEmit =
        done ||
        firstAnnotationReady ||
        byteDelta >= prefixThrottleBytes ||
        annotationsReady
      if (!shouldEmit) {
        break
      }
      const emittedThroughBefore = lastPrefixEmittedThrough
      await emitPrefixNow(done)
      if (lastPrefixEmittedThrough === emittedThroughBefore) {
        break
      }
      if (
        !done &&
        completeThroughIndex === beforeThrough &&
        byteDelta < prefixThrottleBytes
      ) {
        break
      }
      if (done || lastPrefixEmittedThrough >= completeThroughIndex) {
        break
      }
    }
  }

  pushBytes(firstChunk)
  rangeIndex++
  let moreRemaining = firstChunk.byteLength >= rangeChunkBytes
  await drainDecodablePrefixes(!moreRemaining)

  while (moreRemaining) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    const start = payloadLen
    const end = start + rangeChunkBytes - 1
    const parts = await retrieveBulkData({
      BulkDataURI,
      mediaTypes: [{ mediaType: 'application/octet-stream' }],
      byteRange: [start, end],
    })
    if (parts.length === 0 || parts[0] == null) {
      break
    }
    const chunk = partToUint8(parts[0])
    if (chunk.byteLength === 0) {
      break
    }
    // Some servers re-send from 0 when Range is unsupported mid-stream.
    if (chunk.byteLength > rangeChunkBytes * 2) {
      console.warn(
        '[Viv bulk] oversized range response mid-stream; stopping Range loop',
        { chunkBytes: chunk.byteLength, start, end },
      )
      break
    }
    pushBytes(chunk)
    rangeIndex++
    moreRemaining = chunk.byteLength >= rangeChunkBytes
    await drainDecodablePrefixes(!moreRemaining)
  }

  const finalElementCount = Math.floor(payloadLen / elementByteSize)
  completeThroughIndex = numberOfAnnotations - 1
  await drainDecodablePrefixes(true)

  const finalView = makeGraphicDataView(kind, payload.buffer, finalElementCount)
  if (onPrefix != null && lastPrefixEmittedThrough < completeThroughIndex) {
    await onPrefix({
      graphicData: finalView,
      completeThroughIndex,
      availableElementCount: finalElementCount,
      loadedBytes,
      totalBytes: loadedBytes,
      done: true,
    })
    lastPrefixEmittedThrough = completeThroughIndex
    await yieldToBrowser()
  }

  onProgress?.(loadedBytes, loadedBytes)
  vivBulkAnnDebug('bulkStream:done', {
    route: 'client-range',
    rangeIndex,
    loadedBytes,
    finalElementCount,
    numberOfAnnotations,
  })
  return finalView
}

function parseContentRangeTotal(contentRange: string | null): number | null {
  if (contentRange == null || contentRange.length === 0) {
    return null
  }
  // e.g. "bytes 0-2097151/52345678" or "bytes */52345678"
  const match = /bytes\s+(?:\d+-\d+|\*)\/(\d+)/i.exec(contentRange)
  if (match == null) {
    return null
  }
  const total = Number(match[1])
  return Number.isFinite(total) && total > 0 ? total : null
}

type StreamInternalOptions = {
  resolvedUrl: string
  headers: Record<string, string>
  credentials: RequestCredentials
  signal?: AbortSignal
  kind: StreamableBulkKind
  elementByteSize: number
  graphicIndex: Int32Array
  numberOfAnnotations: number
  prefixThrottleBytes: number
  prefixEmitAnnotationStep: number
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
  onPrefix?: (info: BulkPrefixInfo) => void | Promise<void>
}

/**
 * Progressive retrieve via sequential Range GETs. Returns `null` when the
 * server ignores/rejects Range so the caller can fall back to a full GET.
 */
async function tryStreamBulkGraphicDataViaRanges(
  options: StreamInternalOptions & { rangeChunkBytes: number },
): Promise<StreamableBulkGraphicArray | null> {
  const {
    resolvedUrl,
    headers,
    credentials,
    signal,
    kind,
    elementByteSize,
    graphicIndex,
    numberOfAnnotations,
    rangeChunkBytes,
    prefixThrottleBytes,
    prefixEmitAnnotationStep,
    onProgress,
    onPrefix,
  } = options

  const firstEnd = Math.max(0, rangeChunkBytes - 1)
  const firstResponse = await fetch(resolvedUrl, {
    method: 'GET',
    headers: {
      ...headers,
      // Range is only valid for single-part octet-stream (dicomweb-client rule).
      Accept: 'application/octet-stream',
      Range: `bytes=0-${firstEnd}`,
    },
    credentials,
    signal,
  })

  if (firstResponse.status === 200) {
    // Server ignored Range and returned the whole object — still usable, but
    // may be fully buffered before the body becomes readable (same GCP issue).
    vivBulkAnnDebug('bulkStream:range ignored (HTTP 200); reading body', {
      url: resolvedUrl,
    })
    if (firstResponse.body == null) {
      return null
    }
    return await consumeBulkBodyStream({
      response: firstResponse,
      kind,
      elementByteSize,
      graphicIndex,
      numberOfAnnotations,
      prefixThrottleBytes,
      prefixEmitAnnotationStep,
      onProgress,
      onPrefix,
      expectMultipart: false,
      route: 'range-ignored-200',
    })
  }

  if (firstResponse.status !== 206) {
    vivBulkAnnDebug('bulkStream:range unsupported; falling back to full GET', {
      status: firstResponse.status,
      url: resolvedUrl,
    })
    // Consume/cancel body so the socket can be reused.
    try {
      await firstResponse.body?.cancel()
    } catch {
      /* ignore */
    }
    return null
  }

  let totalBytes = parseContentRangeTotal(
    firstResponse.headers.get('Content-Range'),
  )
  const firstLenHeader = firstResponse.headers.get('Content-Length')
  const firstChunkLen =
    firstLenHeader != null && firstLenHeader.length > 0
      ? Number(firstLenHeader)
      : null
  if (
    totalBytes == null &&
    firstChunkLen != null &&
    Number.isFinite(firstChunkLen) &&
    firstChunkLen > 0 &&
    firstChunkLen < rangeChunkBytes
  ) {
    // Tiny object returned as a single 206 covering the whole resource.
    totalBytes = firstChunkLen
  }
  if (totalBytes == null || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    vivBulkAnnDebug('bulkStream:range missing Content-Range total; fallback', {
      contentRange: firstResponse.headers.get('Content-Range'),
    })
    try {
      await firstResponse.body?.cancel()
    } catch {
      /* ignore */
    }
    return null
  }

  let payload = new Uint8Array(totalBytes)
  let payloadLen = 0
  let loadedBytes = 0
  let completeThroughIndex = -1
  let lastPrefixPayloadLen = 0
  let lastPrefixEmittedThrough = -1
  let rangeRequestCount = 0

  const ensureCapacity = (extra: number): void => {
    const needed = payloadLen + extra
    if (needed <= payload.length) {
      return
    }
    let next = payload.length * 2
    while (next < needed) {
      next *= 2
    }
    const grown = new Uint8Array(next)
    grown.set(payload.subarray(0, payloadLen))
    payload = grown
  }

  const pushBytes = (chunk: Uint8Array): void => {
    if (chunk.length === 0) {
      return
    }
    ensureCapacity(chunk.length)
    payload.set(chunk, payloadLen)
    payloadLen += chunk.length
    loadedBytes += chunk.length
    onProgress?.(loadedBytes, totalBytes)
  }

  const elementsAvailable = (): number =>
    Math.floor(payloadLen / elementByteSize)

  const advanceCompleteThrough = (
    availableElements: number,
    done: boolean,
  ): number => {
    const n = numberOfAnnotations
    let i = completeThroughIndex
    while (i + 1 < n) {
      const next = i + 1
      const endElement =
        next + 1 < n
          ? Number(graphicIndex[next + 1]) - 1
          : done
            ? availableElements
            : Number.POSITIVE_INFINITY
      if (endElement <= availableElements) {
        i = next
      } else {
        break
      }
    }
    completeThroughIndex = i
    return i
  }

  const emitPrefixNow = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    const availableElements = elementsAvailable()
    const throughIndex = advanceCompleteThrough(availableElements, done)
    if (!done && throughIndex < 0 && availableElements === 0) {
      return
    }
    const emitThrough = done
      ? throughIndex
      : Math.min(
          throughIndex,
          lastPrefixEmittedThrough + prefixEmitAnnotationStep,
        )
    if (!done && emitThrough <= lastPrefixEmittedThrough) {
      return
    }
    lastPrefixPayloadLen = payloadLen
    await onPrefix({
      graphicData: makeGraphicDataView(kind, payload.buffer, availableElements),
      completeThroughIndex: emitThrough,
      availableElementCount: availableElements,
      loadedBytes,
      totalBytes,
      done,
    })
    lastPrefixEmittedThrough = Math.max(lastPrefixEmittedThrough, emitThrough)
    await yieldToBrowser()
  }

  const drainDecodablePrefixes = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    for (;;) {
      const availableElements = elementsAvailable()
      const beforeThrough = completeThroughIndex
      advanceCompleteThrough(availableElements, done)
      const byteDelta = payloadLen - lastPrefixPayloadLen
      const firstAnnotationReady =
        lastPrefixEmittedThrough < 0 && completeThroughIndex >= 0
      const annotationsReady =
        completeThroughIndex - lastPrefixEmittedThrough >=
        prefixEmitAnnotationStep
      const shouldEmit =
        done ||
        firstAnnotationReady ||
        byteDelta >= prefixThrottleBytes ||
        annotationsReady
      if (!shouldEmit) {
        break
      }
      const emittedThroughBefore = lastPrefixEmittedThrough
      await emitPrefixNow(done)
      if (lastPrefixEmittedThrough === emittedThroughBefore) {
        break
      }
      if (
        !done &&
        completeThroughIndex === beforeThrough &&
        byteDelta < prefixThrottleBytes
      ) {
        break
      }
      if (done || lastPrefixEmittedThrough >= completeThroughIndex) {
        break
      }
    }
  }

  const readResponseIntoPayload = async (response: Response): Promise<void> => {
    if (response.body == null) {
      throw new Error('bulk range: response has no readable body')
    }
    const reader = response.body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        if (value == null || value.length === 0) {
          continue
        }
        pushBytes(value)
      }
    } finally {
      reader.releaseLock?.()
    }
  }

  await readResponseIntoPayload(firstResponse)
  rangeRequestCount++
  await drainDecodablePrefixes(payloadLen >= totalBytes)

  while (payloadLen < totalBytes) {
    if (signal?.aborted === true) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    const start = payloadLen
    const end = Math.min(totalBytes - 1, start + rangeChunkBytes - 1)
    const response = await fetch(resolvedUrl, {
      method: 'GET',
      headers: {
        ...headers,
        Accept: 'application/octet-stream',
        Range: `bytes=${start}-${end}`,
      },
      credentials,
      signal,
    })
    if (response.status !== 206 && response.status !== 200) {
      throw new Error(
        `bulk range HTTP ${response.status} at bytes=${start}-${end}`,
      )
    }
    await readResponseIntoPayload(response)
    rangeRequestCount++
    await drainDecodablePrefixes(payloadLen >= totalBytes)
  }

  const finalElementCount = Math.floor(payloadLen / elementByteSize)
  completeThroughIndex = numberOfAnnotations - 1
  await drainDecodablePrefixes(true)

  const finalView = makeGraphicDataView(kind, payload.buffer, finalElementCount)
  if (onPrefix != null && lastPrefixEmittedThrough < completeThroughIndex) {
    await onPrefix({
      graphicData: finalView,
      completeThroughIndex,
      availableElementCount: finalElementCount,
      loadedBytes,
      totalBytes,
      done: true,
    })
    lastPrefixEmittedThrough = completeThroughIndex
    await yieldToBrowser()
  }

  vivBulkAnnDebug('bulkStream:done', {
    route: 'range',
    rangeRequestCount,
    loadedBytes,
    totalBytes,
    finalElementCount,
    numberOfAnnotations,
  })
  return finalView
}

/** Full multipart (or single-part) GET — used when Range is unavailable. */
async function streamBulkGraphicDataFullGet(
  options: StreamInternalOptions,
): Promise<StreamableBulkGraphicArray> {
  const {
    resolvedUrl,
    headers,
    credentials,
    signal,
    kind,
    elementByteSize,
    graphicIndex,
    numberOfAnnotations,
    prefixThrottleBytes,
    prefixEmitAnnotationStep,
    onProgress,
    onPrefix,
  } = options

  const response = await fetch(resolvedUrl, {
    method: 'GET',
    headers: {
      ...headers,
      Accept: 'multipart/related; type="application/octet-stream"',
    },
    credentials,
    signal,
  })
  if (!response.ok) {
    throw new Error(`bulk stream HTTP ${response.status}`)
  }
  if (response.body == null) {
    throw new Error('bulk stream: response has no readable body')
  }

  return await consumeBulkBodyStream({
    response,
    kind,
    elementByteSize,
    graphicIndex,
    numberOfAnnotations,
    prefixThrottleBytes,
    prefixEmitAnnotationStep,
    onProgress,
    onPrefix,
    expectMultipart: true,
    route: 'full-get',
  })
}

async function consumeBulkBodyStream(options: {
  response: Response
  kind: StreamableBulkKind
  elementByteSize: number
  graphicIndex: Int32Array
  numberOfAnnotations: number
  prefixThrottleBytes: number
  prefixEmitAnnotationStep: number
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
  onPrefix?: (info: BulkPrefixInfo) => void | Promise<void>
  expectMultipart: boolean
  route: string
}): Promise<StreamableBulkGraphicArray> {
  const {
    response,
    kind,
    elementByteSize,
    graphicIndex,
    numberOfAnnotations,
    prefixThrottleBytes,
    prefixEmitAnnotationStep,
    onProgress,
    onPrefix,
    expectMultipart,
    route,
  } = options

  const contentType = response.headers.get('Content-Type') ?? ''
  const contentLengthRaw = response.headers.get('Content-Length')
  const totalBytes =
    contentLengthRaw != null && contentLengthRaw.length > 0
      ? Number(contentLengthRaw)
      : null
  const boundary = extractMultipartBoundary(contentType)
  const isMultipart = expectMultipart ? boundary != null : boundary != null

  const closingDelimiter =
    boundary != null ? asciiBytes(`\r\n--${boundary}`) : new Uint8Array(0)
  const trailingGuard = isMultipart ? closingDelimiter.length + 8 : 0
  const headerTerminator = asciiBytes('\r\n\r\n')

  let payload =
    totalBytes != null && Number.isFinite(totalBytes) && totalBytes > 0
      ? new Uint8Array(totalBytes)
      : new Uint8Array(4 * 1024 * 1024)
  let payloadLen = 0

  const ensureCapacity = (extra: number): void => {
    const needed = payloadLen + extra
    if (needed <= payload.length) {
      return
    }
    let next = payload.length * 2
    while (next < needed) {
      next *= 2
    }
    const grown = new Uint8Array(next)
    grown.set(payload.subarray(0, payloadLen))
    payload = grown
  }

  const pushPayload = (chunk: Uint8Array, from: number): void => {
    const len = chunk.length - from
    if (len <= 0) {
      return
    }
    ensureCapacity(len)
    payload.set(from === 0 ? chunk : chunk.subarray(from), payloadLen)
    payloadLen += len
  }

  let headerFound = !isMultipart
  let headerBytes = new Uint8Array(0)

  if (response.body == null) {
    throw new Error('bulk stream: response has no readable body')
  }
  const reader = response.body.getReader()
  let loadedBytes = 0
  let completeThroughIndex = -1
  let lastPrefixPayloadLen = 0
  let lastPrefixEmittedThrough = -1
  let readCallCount = 0
  let firstByteMs: number | null = null
  const tHeaders0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  const readChunkSizes: number[] = []

  const elementsAvailable = (): number => {
    const usable = Math.max(0, payloadLen - trailingGuard)
    return Math.floor(usable / elementByteSize)
  }

  const advanceCompleteThrough = (
    availableElements: number,
    done: boolean,
  ): number => {
    const n = numberOfAnnotations
    let i = completeThroughIndex
    while (i + 1 < n) {
      const next = i + 1
      const endElement =
        next + 1 < n
          ? Number(graphicIndex[next + 1]) - 1
          : done
            ? availableElements
            : Number.POSITIVE_INFINITY
      if (endElement <= availableElements) {
        i = next
      } else {
        break
      }
    }
    completeThroughIndex = i
    return i
  }

  const emitPrefixNow = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    const availableElements = elementsAvailable()
    const throughIndex = advanceCompleteThrough(availableElements, done)
    if (!done && throughIndex < 0 && availableElements === 0) {
      return
    }
    const emitThrough = done
      ? throughIndex
      : Math.min(
          throughIndex,
          lastPrefixEmittedThrough + prefixEmitAnnotationStep,
        )
    if (!done && emitThrough <= lastPrefixEmittedThrough) {
      return
    }
    lastPrefixPayloadLen = payloadLen
    await onPrefix({
      graphicData: makeGraphicDataView(kind, payload.buffer, availableElements),
      completeThroughIndex: emitThrough,
      availableElementCount: availableElements,
      loadedBytes,
      totalBytes,
      done,
    })
    lastPrefixEmittedThrough = Math.max(lastPrefixEmittedThrough, emitThrough)
    await yieldToBrowser()
  }

  const drainDecodablePrefixes = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    for (;;) {
      const availableElements = elementsAvailable()
      const beforeThrough = completeThroughIndex
      advanceCompleteThrough(availableElements, done)
      const byteDelta = payloadLen - lastPrefixPayloadLen
      const firstAnnotationReady =
        lastPrefixEmittedThrough < 0 && completeThroughIndex >= 0
      const annotationsReady =
        completeThroughIndex - lastPrefixEmittedThrough >=
        prefixEmitAnnotationStep
      const shouldEmit =
        done ||
        firstAnnotationReady ||
        byteDelta >= prefixThrottleBytes ||
        annotationsReady
      if (!shouldEmit) {
        break
      }
      const emittedThroughBefore = lastPrefixEmittedThrough
      await emitPrefixNow(done)
      if (lastPrefixEmittedThrough === emittedThroughBefore) {
        break
      }
      if (
        !done &&
        completeThroughIndex === beforeThrough &&
        byteDelta < prefixThrottleBytes
      ) {
        break
      }
      if (done || lastPrefixEmittedThrough >= completeThroughIndex) {
        break
      }
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (value == null || value.length === 0) {
        continue
      }
      readCallCount++
      if (firstByteMs == null) {
        firstByteMs =
          (typeof performance !== 'undefined'
            ? performance.now()
            : Date.now()) - tHeaders0
      }
      if (readChunkSizes.length < 8) {
        readChunkSizes.push(value.length)
      }
      loadedBytes += value.length
      onProgress?.(loadedBytes, totalBytes)

      if (!headerFound) {
        const merged = new Uint8Array(headerBytes.length + value.length)
        merged.set(headerBytes, 0)
        merged.set(value, headerBytes.length)
        const term = indexOfSubarray(merged, merged.length, headerTerminator, 0)
        if (term === -1) {
          headerBytes = merged
          continue
        }
        headerFound = true
        headerBytes = new Uint8Array(0)
        pushPayload(merged, term + headerTerminator.length)
      } else {
        pushPayload(value, 0)
      }

      await drainDecodablePrefixes(false)
    }
  } finally {
    reader.releaseLock?.()
  }

  let payloadEnd = payloadLen
  if (isMultipart) {
    const found = lastIndexOfSubarray(payload, payloadLen, closingDelimiter)
    if (found >= 0) {
      payloadEnd = found
    }
  }
  const finalElementCount = Math.floor(payloadEnd / elementByteSize)
  payloadLen = payloadEnd
  completeThroughIndex = numberOfAnnotations - 1

  await drainDecodablePrefixes(false)

  const finalView = makeGraphicDataView(kind, payload.buffer, finalElementCount)
  if (onPrefix != null && lastPrefixEmittedThrough < completeThroughIndex) {
    await onPrefix({
      graphicData: finalView,
      completeThroughIndex,
      availableElementCount: finalElementCount,
      loadedBytes,
      totalBytes,
      done: true,
    })
    lastPrefixEmittedThrough = completeThroughIndex
    await yieldToBrowser()
  }

  const likelyBufferedByProxy =
    readCallCount <= 2 &&
    totalBytes != null &&
    totalBytes > 8 * 1024 * 1024 &&
    (firstByteMs ?? 0) > 500

  vivBulkAnnDebug('bulkStream:done', {
    route,
    isMultipart,
    loadedBytes,
    totalBytes,
    finalElementCount,
    numberOfAnnotations,
    readCallCount,
    firstByteMs: firstByteMs != null ? Math.round(firstByteMs) : null,
    readChunkSizes,
    likelyBufferedByProxy,
  })
  if (likelyBufferedByProxy) {
    // Loud breadcrumb: this is the “points appear only after download” case.
    console.warn(
      '[Viv bulk] response looks buffered by origin/proxy (few huge reads after long wait). Prefer Range path; check Network for 206 Partial Content.',
      { route, readCallCount, firstByteMs, totalBytes },
    )
  }
  return finalView
}

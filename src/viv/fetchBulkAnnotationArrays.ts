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
  const ref =
    (bulkdataItem.PointCoordinatesData as BulkDataReference | undefined) ??
    (bulkdataItem.DoublePointCoordinatesData as BulkDataReference | undefined)
  if (
    ref == null ||
    typeof ref.BulkDataURI !== 'string' ||
    ref.BulkDataURI.length === 0
  ) {
    return null
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
  /** Network progress (whole-response bytes). */
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
  /** Newly-available, element-aligned coordinate prefix (throttled). */
  onPrefix?: (info: BulkPrefixInfo) => void | Promise<void>
  /** Emit a prefix at most this often by payload bytes (default 12 MiB). */
  prefixThrottleBytes?: number
}

/**
 * Stream the coordinate bulk data, invoking `onPrefix` with growing,
 * element-aligned prefixes as bytes arrive, and resolving with the complete
 * coordinate typed array.
 *
 * Throws (so the caller can fall back) when the response is not OK, the body is
 * not streamable, or decoding the envelope fails.
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
  } = options
  const vrInfo = getStreamableBulkVrInfo(vr)
  if (vrInfo == null) {
    throw new Error(`bulk streaming unsupported for VR "${vr}"`)
  }
  const { elementByteSize, kind } = vrInfo
  const prefixThrottleBytes = options.prefixThrottleBytes ?? 12 * 1024 * 1024

  const resolvedUrl =
    baseUrl != null && baseUrl.length > 0
      ? new URL(url, baseUrl).toString()
      : url

  const response = await fetch(resolvedUrl, {
    method: 'GET',
    headers: {
      ...headers,
      Accept: 'multipart/related; type="application/octet-stream"',
    },
    signal,
  })
  if (!response.ok) {
    throw new Error(`bulk stream HTTP ${response.status}`)
  }
  if (response.body == null) {
    throw new Error('bulk stream: response has no readable body')
  }

  const contentType = response.headers.get('Content-Type') ?? ''
  const contentLengthRaw = response.headers.get('Content-Length')
  const totalBytes =
    contentLengthRaw != null && contentLengthRaw.length > 0
      ? Number(contentLengthRaw)
      : null
  const boundary = extractMultipartBoundary(contentType)
  const isMultipart = boundary != null

  // Closing delimiter `\r\n--<boundary>` precedes the payload tail. We never
  // expose the last `trailingGuard` bytes mid-stream so boundary bytes are not
  // mistaken for coordinates; the exact end is found once the stream completes.
  const closingDelimiter =
    boundary != null ? asciiBytes(`\r\n--${boundary}`) : new Uint8Array(0)
  const trailingGuard = isMultipart ? closingDelimiter.length + 8 : 0
  const headerTerminator = asciiBytes('\r\n\r\n')

  // Payload accumulator (offset 0 → element-aligned views). Preallocate from
  // Content-Length when available to avoid reallocations on large blobs.
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

  // Pre-payload header bytes (multipart only) accumulate here until the blank
  // line that terminates the part headers is seen.
  let headerFound = !isMultipart
  let headerBytes = new Uint8Array(0)

  const reader = response.body.getReader()
  let loadedBytes = 0
  let completeThroughIndex = -1
  let lastPrefixPayloadLen = 0

  const elementsAvailable = (): number => {
    const usable = Math.max(0, payloadLen - trailingGuard)
    return Math.floor(usable / elementByteSize)
  }

  /** Advance `completeThroughIndex` given currently-available elements. */
  const advanceCompleteThrough = (
    availableElements: number,
    done: boolean,
  ): void => {
    const n = numberOfAnnotations
    let i = completeThroughIndex
    while (i + 1 < n) {
      const next = i + 1
      // Annotation `next` ends at element `graphicIndex[next+1]-1` (exclusive),
      // or the full buffer for the final annotation (only known when done).
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
  }

  const emitPrefix = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    const availableElements = elementsAvailable()
    advanceCompleteThrough(availableElements, done)
    const view = makeGraphicDataView(kind, payload.buffer, availableElements)
    await onPrefix({
      graphicData: view,
      completeThroughIndex,
      availableElementCount: availableElements,
      loadedBytes,
      totalBytes,
      done,
    })
    lastPrefixPayloadLen = payloadLen
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
      loadedBytes += value.length
      onProgress?.(loadedBytes, totalBytes)

      if (!headerFound) {
        // Accumulate until the part-header terminator is found, then route the
        // tail into the payload accumulator.
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

      if (payloadLen - lastPrefixPayloadLen >= prefixThrottleBytes) {
        await emitPrefix(false)
      }
    }
  } finally {
    reader.releaseLock?.()
  }

  // Trim the multipart closing delimiter to get the exact payload length.
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

  const finalView = makeGraphicDataView(kind, payload.buffer, finalElementCount)
  if (onPrefix != null) {
    await onPrefix({
      graphicData: finalView,
      completeThroughIndex,
      availableElementCount: finalElementCount,
      loadedBytes,
      totalBytes,
      done: true,
    })
  }
  vivBulkAnnDebug('bulkStream:done', {
    isMultipart,
    loadedBytes,
    totalBytes,
    finalElementCount,
    numberOfAnnotations,
  })
  return finalView
}

/**
 * Shared progressive prefix-emission machinery for the bulk coordinate
 * streaming routes in `fetchBulkAnnotationArrays` (dicomweb-client Range,
 * raw fetch Range, and full GET).
 *
 * Each route owns its payload byte buffer; this helper tracks which
 * annotations are fully present (via the 1-based `graphicIndex`), throttles
 * `onPrefix` callbacks by bytes and by annotation count, and validates at end
 * of stream that the received bytes can actually contain every annotation the
 * index promises (throwing on shortfall so callers run their fallback path
 * instead of silently reporting a truncated group as complete).
 */

import { logger } from '../utils/logger'
import type {
  BulkPrefixInfo,
  StreamableBulkGraphicArray,
} from './fetchBulkAnnotationArrays'
import { vivBulkAnnDebug } from './vivBulkAnnDebug'

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

export type BulkPrefixEmitter = {
  /**
   * Emit throttled prefixes for annotations that became fully available since
   * the last call. Pass `done: true` when the route believes the transfer has
   * ended (mirrors the pre-refactor per-route drain semantics).
   */
  drain: (done: boolean) => Promise<void>
  /**
   * End-of-stream: validate completeness against `graphicIndex`, run a final
   * drain, emit the last `done` prefix if needed, and return the final
   * element-aligned view of the payload buffer.
   *
   * Throws when the payload ended short of what the last `graphicIndex` entry
   * implies, so the caller's fallback (full GET / monolithic DMV retrieve)
   * runs instead of silently dropping annotations.
   */
  finish: (
    finalElementCount: number,
    opts?: {
      /**
       * Whether the final pre-emit drain passes `done: true` (client/fetch
       * Range routes) or `done: false` (full-GET body consumer) — kept
       * per-route to preserve the exact emission cadence each had before.
       */
      finalDrainDone?: boolean
    },
  ) => Promise<StreamableBulkGraphicArray>
  /**
   * Reset the byte-throttle baseline. Call after restarting the payload
   * buffer from offset 0 (e.g. a server ignored Range mid-stream and the
   * route replaced the buffer with the full response body).
   */
  resetByteBaseline: () => void
}

export function createBulkPrefixEmitter(options: {
  kind: 'int32' | 'float32'
  elementByteSize: number
  graphicIndex: Int32Array
  numberOfAnnotations: number
  prefixThrottleBytes: number
  prefixEmitAnnotationStep: number
  onPrefix?: (info: BulkPrefixInfo) => void | Promise<void>
  /** Current payload buffer (may be reallocated as the route grows it). */
  getPayloadBuffer: () => ArrayBuffer
  /** Valid payload bytes currently in the buffer. */
  getPayloadLength: () => number
  /** Total network bytes received so far. */
  getLoadedBytes: () => number
  /** `Content-Length`-style total when the route knows it, else `null`. */
  getTotalBytes: () => number | null
  /** Bytes at the end of the payload that may still belong to a multipart trailer. */
  trailingGuardBytes?: number
  /** Route label for debug logging. */
  route: string
}): BulkPrefixEmitter {
  const {
    kind,
    elementByteSize,
    graphicIndex,
    numberOfAnnotations,
    prefixThrottleBytes,
    prefixEmitAnnotationStep,
    onPrefix,
    getPayloadBuffer,
    getPayloadLength,
    getLoadedBytes,
    getTotalBytes,
    route,
  } = options
  const trailingGuardBytes = options.trailingGuardBytes ?? 0

  let completeThroughIndex = -1
  let lastPrefixPayloadLen = 0
  let lastPrefixEmittedThrough = -1

  const makeView = (elementCount: number): StreamableBulkGraphicArray =>
    kind === 'int32'
      ? new Int32Array(getPayloadBuffer(), 0, elementCount)
      : new Float32Array(getPayloadBuffer(), 0, elementCount)

  const elementsAvailable = (): number => {
    const usable = Math.max(0, getPayloadLength() - trailingGuardBytes)
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
    lastPrefixPayloadLen = getPayloadLength()
    const loadedBytes = getLoadedBytes()
    await onPrefix({
      graphicData: makeView(availableElements),
      completeThroughIndex: emitThrough,
      availableElementCount: availableElements,
      loadedBytes,
      totalBytes: getTotalBytes(),
      done,
    })
    lastPrefixEmittedThrough = Math.max(lastPrefixEmittedThrough, emitThrough)
    vivBulkAnnDebug('bulkStream:progressive prefix', {
      route,
      annotationsThrough: emitThrough + 1,
      numberOfAnnotations,
      loadedMiB: Math.round((loadedBytes / (1024 * 1024)) * 10) / 10,
      done,
    })
    await yieldToBrowser()
  }

  const drain = async (done: boolean): Promise<void> => {
    if (onPrefix == null) {
      return
    }
    for (;;) {
      const availableElements = elementsAvailable()
      const beforeThrough = completeThroughIndex
      advanceCompleteThrough(availableElements, done)
      const byteDelta = getPayloadLength() - lastPrefixPayloadLen
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

  /**
   * Detect a stream that ended short of what `graphicIndex` implies. The last
   * index entry is the 1-based start offset of the final annotation's first
   * coordinate, so the buffer must hold at least that many elements for every
   * annotation to be (at least partially) present.
   */
  const assertStreamComplete = (finalElementCount: number): void => {
    if (numberOfAnnotations <= 0 || graphicIndex.length < numberOfAnnotations) {
      return
    }
    const requiredMinElements = Number(graphicIndex[numberOfAnnotations - 1])
    if (
      !Number.isFinite(requiredMinElements) ||
      finalElementCount >= requiredMinElements
    ) {
      return
    }
    let completeAnnotations = 0
    for (let i = 0; i + 1 < numberOfAnnotations; i++) {
      if (Number(graphicIndex[i + 1]) - 1 <= finalElementCount) {
        completeAnnotations = i + 1
      } else {
        break
      }
    }
    logger.warn(
      `[Viv bulk] bulk coordinate stream ended short: got ${finalElementCount} elements but graphicIndex requires at least ${requiredMinElements}; only ~${completeAnnotations}/${numberOfAnnotations} annotations are complete (route ${route}). Falling back instead of reporting a truncated group as complete.`,
    )
    throw new Error(
      `bulk stream truncated (route ${route}): ${finalElementCount} elements < ${requiredMinElements} required by graphicIndex`,
    )
  }

  const finish = async (
    finalElementCount: number,
    opts?: { finalDrainDone?: boolean },
  ): Promise<StreamableBulkGraphicArray> => {
    assertStreamComplete(finalElementCount)
    completeThroughIndex = numberOfAnnotations - 1
    await drain(opts?.finalDrainDone ?? true)
    const finalView = makeView(finalElementCount)
    if (onPrefix != null && lastPrefixEmittedThrough < completeThroughIndex) {
      await onPrefix({
        graphicData: finalView,
        completeThroughIndex,
        availableElementCount: finalElementCount,
        loadedBytes: getLoadedBytes(),
        totalBytes: getTotalBytes() ?? getLoadedBytes(),
        done: true,
      })
      lastPrefixEmittedThrough = completeThroughIndex
      await yieldToBrowser()
    }
    return finalView
  }

  return {
    drain,
    finish,
    resetByteBaseline: (): void => {
      lastPrefixPayloadLen = 0
    },
  }
}

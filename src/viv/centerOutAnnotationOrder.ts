import { computeFirstVertexDeckXYArray } from './annotationCoords'

/** Minimum annotation count before offloading center-out sort to a Web Worker. */
export const CENTER_OUT_ORDER_WORKER_MIN = 25_000

export type CenterOutOrderInput = {
  numberOfAnnotations: number
  graphicData: Int32Array | Float32Array
  graphicIndex: Int32Array | null
  coordinateDimensionality: number
  commonZCoordinate: number
  deckCoeffs: readonly [number, number, number, number, number, number]
  loadCenter: [number, number]
}

/**
 * Canonical distance + sort kernel shared by the sync path and the worker.
 *
 * `firstVertexXY` is an n×2 array of each annotation's first vertex in deck XY
 * (non-finite entries mark invalid/missing vertices and sort last). The
 * function must stay self-contained (globals only, no captured identifiers):
 * its compiled source is serialized with `toString()` into the worker blob so
 * the worker and the sync fallback cannot drift.
 */
function centerOutOrderFromFirstVertexXY(
  numberOfAnnotations: number,
  firstVertexXY: Float64Array,
  centerX: number,
  centerY: number,
): Uint32Array {
  const distances = new Float64Array(numberOfAnnotations)
  for (let i = 0; i < numberOfAnnotations; i++) {
    const x = firstVertexXY[2 * i]
    const y = firstVertexXY[2 * i + 1]
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const dx = x - centerX
      const dy = y - centerY
      distances[i] = dx * dx + dy * dy
    } else {
      distances[i] = Number.POSITIVE_INFINITY
    }
  }
  const order = new Uint32Array(numberOfAnnotations)
  for (let i = 0; i < numberOfAnnotations; i++) {
    order[i] = i
  }
  order.sort((a, b) => distances[a] - distances[b])
  return order
}

/**
 * The sort only needs each annotation's first vertex, so extract an n×2
 * deck-XY array (16 bytes per annotation) instead of touching — or copying —
 * the full coordinate buffer.
 */
function firstVertexXYFromInput(options: CenterOutOrderInput): Float64Array {
  return computeFirstVertexDeckXYArray({
    numberOfAnnotations: options.numberOfAnnotations,
    graphicData: options.graphicData,
    graphicIndex: options.graphicIndex,
    coordinateDimensionality: options.coordinateDimensionality,
    commonZCoordinate: options.commonZCoordinate,
    deckCoeffs: options.deckCoeffs,
  })
}

/** Main-thread center-out sort (used for smaller groups and as worker fallback). */
export function computeCenterOutAnnotationOrderSync(
  options: CenterOutOrderInput,
): Uint32Array {
  const firstVertexXY = firstVertexXYFromInput(options)
  return centerOutOrderFromFirstVertexXY(
    options.numberOfAnnotations,
    firstVertexXY,
    options.loadCenter[0],
    options.loadCenter[1],
  )
}

let centerOutWorker: Worker | null = null
let centerOutWorkerSeq = 0
/** In-flight request rejectors so {@link terminateCenterOutAnnotationOrderWorker} can fail them. */
const pendingWorkerRejects = new Map<number, (err: Error) => void>()

/** Thrown when the shared worker is torn down with requests still pending. */
export class CenterOutWorkerTerminatedError extends Error {
  constructor() {
    super('centerOutAnnotationOrder: worker terminated with requests in flight')
    this.name = 'CenterOutWorkerTerminatedError'
  }
}

function getCenterOutWorker(): Worker {
  if (centerOutWorker != null) {
    return centerOutWorker
  }
  /** Worker source derives from the canonical kernel (single implementation). */
  const workerSource = `var computeOrder=${centerOutOrderFromFirstVertexXY.toString()};self.onmessage=function(e){var d=e.data;var xy=new Float64Array(d.firstVertexXY);var order=computeOrder(d.numberOfAnnotations,xy,d.centerX,d.centerY);self.postMessage({id:d.id,order:order.buffer},[order.buffer]);};`
  const blob = new Blob([workerSource], { type: 'application/javascript' })
  const workerUrl = URL.createObjectURL(blob)
  try {
    centerOutWorker = new Worker(workerUrl)
  } finally {
    /**
     * The worker holds its own reference to the loaded script; revoke
     * immediately so the blob URL does not leak.
     */
    URL.revokeObjectURL(workerUrl)
  }
  return centerOutWorker
}

function computeCenterOutAnnotationOrderInWorker(
  options: CenterOutOrderInput,
): Promise<Uint32Array> {
  const worker = getCenterOutWorker()
  const id = ++centerOutWorkerSeq
  /**
   * Precompute the n×2 first-vertex array on the main thread (index-driven,
   * cheap) and transfer only that — copying the whole coordinate buffer to
   * Float64 transiently cost ~4× the source bytes for exactly the huge groups
   * this worker targets.
   */
  const firstVertexXY = firstVertexXYFromInput(options)
  return new Promise((resolve, reject) => {
    // skipcq: JS-0357 - function declarations are hoisted, enabling mutual references
    function settle(): void {
      pendingWorkerRejects.delete(id)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    function onMessage(
      ev: MessageEvent<{ id: number; order: ArrayBuffer }>,
    ): void {
      if (ev.data.id !== id) {
        return
      }
      settle()
      resolve(new Uint32Array(ev.data.order))
    }
    function onError(err: ErrorEvent): void {
      settle()
      reject(err.error ?? new Error(String(err.message)))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    pendingWorkerRejects.set(id, (err) => {
      settle()
      reject(err)
    })

    worker.postMessage(
      {
        id,
        numberOfAnnotations: options.numberOfAnnotations,
        centerX: options.loadCenter[0],
        centerY: options.loadCenter[1],
        firstVertexXY: firstVertexXY.buffer,
      },
      [firstVertexXY.buffer],
    )
  })
}

/** Center-out annotation index order; uses a worker when `numberOfAnnotations` is large. */
export async function computeCenterOutAnnotationOrder(
  options: CenterOutOrderInput,
): Promise<Uint32Array> {
  if (options.numberOfAnnotations < CENTER_OUT_ORDER_WORKER_MIN) {
    return computeCenterOutAnnotationOrderSync(options)
  }
  try {
    return await computeCenterOutAnnotationOrderInWorker(options)
  } catch (e) {
    /** Unmount termination must not kick off a main-thread mega-sort. */
    if (e instanceof CenterOutWorkerTerminatedError) {
      throw e
    }
    return computeCenterOutAnnotationOrderSync(options)
  }
}

/**
 * Terminate the shared worker (call when the Viv viewport unmounts) and reject
 * any in-flight sort requests so their promises settle instead of hanging.
 * Callers must not fall back to the sync sort for termination rejections —
 * that would sort tens of thousands of annotations on the main thread during
 * teardown.
 */
export function terminateCenterOutAnnotationOrderWorker(): void {
  if (centerOutWorker != null) {
    centerOutWorker.terminate()
    centerOutWorker = null
  }
  if (pendingWorkerRejects.size > 0) {
    const pending = Array.from(pendingWorkerRejects.values())
    pendingWorkerRejects.clear()
    const err = new CenterOutWorkerTerminatedError()
    for (const reject of pending) {
      reject(err)
    }
  }
}

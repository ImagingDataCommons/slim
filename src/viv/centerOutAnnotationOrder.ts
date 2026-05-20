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

function openLayersMapYToVivWorldY(mapY: number): number {
  return -mapY - 1
}

function bulkVertexToDeckFast(
  gx: number,
  gy: number,
  c: readonly [number, number, number, number, number, number],
): [number, number] {
  const pcol = c[0] * gx + c[1] * gy + c[2]
  const prow = c[3] * gx + c[4] * gy + c[5]
  const olMapY = -(prow + 1)
  return [pcol, openLayersMapYToVivWorldY(olMapY)]
}

function readTripleFromGraphicBuffer(
  graphicData: Int32Array | Float32Array,
  j: number,
  commonZCoordinate: number,
): [number, number, number] {
  const gx = Number(graphicData[j])
  const gy = Number(graphicData[j + 1])
  const gz = Number.isNaN(commonZCoordinate)
    ? Number(graphicData[j + 2])
    : Number(commonZCoordinate)
  return [gx, gy, gz]
}

/** Main-thread center-out sort (used for smaller groups and as worker fallback). */
export function computeCenterOutAnnotationOrderSync(
  options: CenterOutOrderInput,
): Uint32Array {
  const {
    numberOfAnnotations,
    graphicData,
    graphicIndex,
    coordinateDimensionality,
    commonZCoordinate,
    deckCoeffs,
    loadCenter,
  } = options
  const [cx, cy] = loadCenter
  const distances = new Float64Array(numberOfAnnotations)
  const hasIndex = graphicIndex !== null && graphicIndex !== undefined
  const minRemain = coordinateDimensionality >= 3 ? 3 : 2

  for (let i = 0; i < numberOfAnnotations; i++) {
    distances[i] = Number.POSITIVE_INFINITY
    const offset = hasIndex
      ? Number(graphicIndex[i] ?? 0) - 1
      : i * coordinateDimensionality
    if (offset < 0 || offset + minRemain - 1 >= graphicData.length) {
      continue
    }
    const [gx, gy] = readTripleFromGraphicBuffer(
      graphicData,
      offset,
      commonZCoordinate,
    )
    if (!gx || !gy) {
      continue
    }
    const [dx, dy] = bulkVertexToDeckFast(gx, gy, deckCoeffs)
    const ddx = dx - cx
    const ddy = dy - cy
    distances[i] = ddx * ddx + ddy * ddy
  }

  const order = new Uint32Array(numberOfAnnotations)
  for (let i = 0; i < numberOfAnnotations; i++) {
    order[i] = i
  }
  order.sort((a, b) => distances[a] - distances[b])
  return order
}

let centerOutWorker: Worker | null = null
let centerOutWorkerSeq = 0

function getCenterOutWorker(): Worker {
  if (centerOutWorker != null) {
    return centerOutWorker
  }
  const blob = new Blob(
    [
      `self.onmessage=function(e){var d=e.data,id=d.id,p=d.payload,b=d.buffers;var gd=new Float64Array(b.graphicData);var gi=b.graphicIndex?new Int32Array(b.graphicIndex):null;var n=p.numberOfAnnotations,cx=p.loadCenter[0],cy=p.loadCenter[1],cd=p.coordinateDimensionality,cz=p.commonZCoordinate,c=p.deckCoeffs,minR=cd>=3?3:2,dist=new Float64Array(n);for(var i=0;i<n;i++){dist[i]=Infinity;var off=gi?gi[i]-1:i*cd;if(off<0||off+minR-1>=gd.length)continue;var gx=gd[off],gy=gd[off+1];if(!gx||!gy)continue;var pcol=c[0]*gx+c[1]*gy+c[2],prow=c[3]*gx+c[4]*gy+c[5],olMapY=-(prow+1),dx=pcol,dy=-olMapY-1,ddx=dx-cx,ddy=dy-cy;dist[i]=ddx*ddx+ddy*ddy;}var order=new Uint32Array(n);for(var j=0;j<n;j++)order[j]=j;order.sort(function(a,b){return dist[a]-dist[b];});self.postMessage({id:id,order:order.buffer},[order.buffer]);};`,
    ],
    { type: 'application/javascript' },
  )
  centerOutWorker = new Worker(URL.createObjectURL(blob))
  return centerOutWorker
}

function graphicDataAsFloat64(
  graphicData: Int32Array | Float32Array,
): Float64Array {
  if (graphicData instanceof Float64Array) {
    return graphicData
  }
  return new Float64Array(graphicData)
}

function computeCenterOutAnnotationOrderInWorker(
  options: CenterOutOrderInput,
): Promise<Uint32Array> {
  const worker = getCenterOutWorker()
  const id = ++centerOutWorkerSeq
  return new Promise((resolve, reject) => {
    const onMessage = (
      ev: MessageEvent<{ id: number; order: ArrayBuffer }>,
    ) => {
      if (ev.data.id !== id) {
        return
      }
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      resolve(new Uint32Array(ev.data.order))
    }
    const onError = (err: ErrorEvent): void => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(err.error ?? new Error(String(err.message)))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)

    const graphicDataF64 = new Float64Array(
      graphicDataAsFloat64(options.graphicData),
    )
    const buffers: { graphicData: ArrayBuffer; graphicIndex?: ArrayBuffer } = {
      graphicData: graphicDataF64.buffer,
    }
    const transfer: ArrayBuffer[] = [graphicDataF64.buffer]
    if (options.graphicIndex != null) {
      const graphicIndexCopy = new Int32Array(options.graphicIndex)
      buffers.graphicIndex = graphicIndexCopy.buffer
      transfer.push(graphicIndexCopy.buffer)
    }

    worker.postMessage(
      {
        id,
        payload: {
          numberOfAnnotations: options.numberOfAnnotations,
          coordinateDimensionality: options.coordinateDimensionality,
          commonZCoordinate: options.commonZCoordinate,
          deckCoeffs: options.deckCoeffs,
          loadCenter: options.loadCenter,
        },
        buffers,
      },
      transfer,
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
  } catch {
    return computeCenterOutAnnotationOrderSync(options)
  }
}

/** Terminate the shared worker (call when the Viv viewport unmounts). */
export function terminateCenterOutAnnotationOrderWorker(): void {
  if (centerOutWorker != null) {
    centerOutWorker.terminate()
    centerOutWorker = null
  }
}

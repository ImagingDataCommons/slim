/**
 * Bridges deck.gl tile {@link AbortSignal}s to dicomweb-client XHR without a single
 * global signal slot (parallel tile loads push/pop on a stack during each loader's
 * synchronous XHR setup phase).
 */

const vivTileAbortSignalStack: Array<AbortSignal | undefined> = []

const vivXhrTileAbort = new WeakMap<XMLHttpRequest, { bridgedAbort: boolean }>()

function currentVivTileAbortSignal(): AbortSignal | undefined {
  return vivTileAbortSignalStack[vivTileAbortSignalStack.length - 1]
}

function isXhrLike(req: unknown): req is XMLHttpRequest {
  if (req === null || typeof req !== 'object') {
    return false
  }
  const r = req as { open?: unknown; abort?: unknown; readyState?: unknown }
  return (
    typeof r.open === 'function' &&
    typeof r.abort === 'function' &&
    typeof r.readyState === 'number'
  )
}

/** Skip dicomweb's onreadystatechange handler for intentional deck tile prune (status 0). */
function suppressDicomwebAbortHandler(
  request: XMLHttpRequest,
  meta: { bridgedAbort: boolean },
): void {
  const prev = request.onreadystatechange
  if (typeof prev !== 'function') {
    return
  }
  request.onreadystatechange = function (this: XMLHttpRequest, ev: Event) {
    if (
      this.readyState === 4 &&
      this.status === 0 &&
      meta.bridgedAbort === true
    ) {
      return
    }
    prev.call(this, ev)
  }
}

function bridgeAbortSignalToXhr(
  request: XMLHttpRequest,
  signal: AbortSignal | undefined,
): void {
  if (signal === undefined) {
    return
  }
  const meta = { bridgedAbort: signal.aborted }
  vivXhrTileAbort.set(request, meta)
  if (signal.aborted) {
    suppressDicomwebAbortHandler(request, meta)
    request.abort()
    return
  }
  signal.addEventListener(
    'abort',
    () => {
      meta.bridgedAbort = true
      suppressDicomwebAbortHandler(request, meta)
      request.abort()
    },
    { once: true },
  )
}

/**
 * Run `fn` while the active tile {@link AbortSignal} is visible to dicomweb
 * {@link requestHooks}. The signal is popped as soon as `fn()` returns; hooks
 * attach XHR listeners during that synchronous window.
 */
export function invokeOpenLayersLoaderWithAbortSignal<T>(
  signal: AbortSignal | undefined,
  fn: () => T,
): T {
  vivTileAbortSignalStack.push(signal)
  try {
    return fn()
  } finally {
    vivTileAbortSignalStack.pop()
  }
}

export function vivXhrTileAbortMeta(
  xhr: XMLHttpRequest,
): { bridgedAbort: boolean } | undefined {
  return vivXhrTileAbort.get(xhr)
}

export function clearVivXhrTileAbortMeta(xhr: XMLHttpRequest): void {
  vivXhrTileAbort.delete(xhr)
}

/** Install once per primary dicomweb client (see {@link DicomLoader}). */
export function installVivDicomwebAbortHooks(inner: {
  requestHooks?: Array<
    (request: XMLHttpRequest, metadata: unknown) => XMLHttpRequest
  >
  errorInterceptor?: (error: { status?: number; message?: string }) => void
}): void {
  const prevHooks = inner.requestHooks ?? []
  const vivHook = (request: unknown, _metadata: unknown): XMLHttpRequest => {
    if (!isXhrLike(request)) {
      return request as XMLHttpRequest
    }
    bridgeAbortSignalToXhr(request, currentVivTileAbortSignal())
    if (currentVivTileAbortSignal()?.aborted === true) {
      request.abort()
    }
    return request
  }
  inner.requestHooks = [...prevHooks, vivHook]

  const prevErr = inner.errorInterceptor
  inner.errorInterceptor = (error) => {
    const err = error as { cause?: unknown; status?: number; message?: string }
    if (!Object.hasOwn(err, 'cause') || err.cause === undefined) {
      err.cause = err
    }
    const errMsg = err.message
    if (err.status === 0 && errMsg === 'request failed') {
      return
    }
    prevErr?.(error)
  }
}

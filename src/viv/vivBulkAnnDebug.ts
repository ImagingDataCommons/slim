/**
 * DevTools: filter by `Viv bulk ANN`.
 * - `console.info` lines with `{ phase, ms }` show where time is spent (default log level).
 * - `console.debug` lines need “Verbose” enabled in Chrome DevTools console.
 * - For long polygon decode progress: `localStorage.setItem('slim:vivBulkAnnDebug', '1')` then reload.
 */

export const VIV_BULK_TAG = '[Viv bulk ANN]'

export function vivBulkAnnNow(): number {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now()
  }
  return Date.now()
}

/** Extra progress inside tight loops (polygon decode). */
export function vivBulkAnnVerboseProgress(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage?.getItem('slim:vivBulkAnnDebug') === '1'
    )
  } catch {
    return false
  }
}

export function vivBulkAnnDebug(
  phase: string,
  payload?: Record<string, unknown>,
): void {
  console.debug(`${VIV_BULK_TAG} ${phase}`, payload ?? '')
}

export function vivBulkAnnPerf(
  phase: string,
  t0: number,
  payload?: Record<string, unknown>,
): void {
  const ms = Math.round((vivBulkAnnNow() - t0) * 10) / 10
  console.info(`${VIV_BULK_TAG} perf`, { phase, ms, ...payload })
}

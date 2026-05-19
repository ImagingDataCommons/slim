/**
 * DevTools: filter console by `phase` (e.g. `hydrate:`, `viewport:`, `metadata:`).
 * - `logger.log` lines with `{ phase, ms }` show where time is spent (LOG level).
 * - `vivBulkAnnPhase` marks major FETCH ↔ PROCESS ↔ DECK BUILD boundaries.
 * - `vivBulkAnnDebug` needs DEBUG level (default in dev; Chrome DevTools “Verbose” filter).
 * - For long polygon decode progress: `localStorage.setItem('slim:vivBulkAnnDebug', '1')` then reload.
 *
 * All output is routed through {@link logger} so it honours `window.config.logger.level`
 * (in production the default level is ERROR, so DEBUG/LOG calls silently no-op).
 */

import { logger } from '../utils/logger'

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
  logger.debug(phase, payload ?? '')
}

export function vivBulkAnnPerf(
  phase: string,
  t0: number,
  payload?: Record<string, unknown>,
): void {
  const ms = Math.round((vivBulkAnnNow() - t0) * 10) / 10
  logger.log({ phase, ms, ...payload })
}

/**
 * Major lifecycle boundary marker (FETCH start/done, PROCESS start/done, DECK BUILD start/done).
 * Logged at LOG level so it shows up without enabling Verbose, and is grep-friendly
 * via the `phase` field in log objects.
 */
export function vivBulkAnnPhase(
  phase: string,
  payload?: Record<string, unknown>,
): void {
  logger.log({ phase, ...(payload ?? {}) })
}

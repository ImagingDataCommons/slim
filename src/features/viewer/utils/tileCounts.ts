/** Pure bookkeeping for the footer's tile progress readout. */

export interface TileCounts {
  requested: number
  loaded: number
  failed: number
}

export type TileEventKind = 'started' | 'ended' | 'error'

export type TileStatus = 'loading' | 'loaded' | 'failed'

export const INITIAL_TILE_COUNTS: TileCounts = {
  requested: 0,
  loaded: 0,
  failed: 0,
}

function framePayload(detail: unknown): object | undefined {
  if (typeof detail !== 'object' || detail === null || !('payload' in detail)) {
    return undefined
  }
  const { payload } = detail
  return typeof payload === 'object' && payload !== null ? payload : undefined
}

/** SOP Instance UID of a DMV frame event's `detail`, if present. */
export function frameEventSopInstanceUID(detail: unknown): string | undefined {
  const payload = framePayload(detail)
  if (payload === undefined || !('sopInstanceUID' in payload)) return undefined
  const uid = payload.sopInstanceUID
  return typeof uid === 'string' && uid !== '' ? uid : undefined
}

/** "<SOPInstanceUID>-<frameNumber>" for a DMV frame event's `detail`. */
export function frameEventKey(detail: unknown): string | undefined {
  const uid = frameEventSopInstanceUID(detail)
  const payload = framePayload(detail)
  const frameNumber =
    payload !== undefined && 'frameNumber' in payload
      ? payload.frameNumber
      : undefined
  if (uid === undefined) return undefined
  if (typeof frameNumber !== 'number' && typeof frameNumber !== 'string') {
    return undefined
  }
  return `${uid}-${String(frameNumber)}`
}

/**
 * DMV publishes `ended` before `error` for a failed frame, so `error` wins
 * over a preceding `ended`; a new `started` clears a failure (retry).
 */
export function nextTileStatus(
  current: TileStatus | undefined,
  kind: TileEventKind,
): TileStatus {
  switch (kind) {
    case 'started':
      return current === 'loaded' ? 'loaded' : 'loading'
    case 'ended':
      return current === 'failed' ? 'failed' : 'loaded'
    case 'error':
      return 'failed'
    default:
      return current ?? 'loading'
  }
}

/** Frames whose status is remembered to deduplicate repeated events */
export const MAX_TRACKED_TILES = 10_000

/**
 * Store `status` for `key` as the most recent entry, then evict the oldest
 * settled entry once `limit` is exceeded. In-flight frames are kept so their
 * `ended` event is not counted as a new request; only when every entry is in
 * flight does the oldest one go.
 */
export function recordTileStatus(
  statuses: Map<string, TileStatus>,
  key: string,
  status: TileStatus,
  limit = MAX_TRACKED_TILES,
): void {
  statuses.delete(key)
  statuses.set(key, status)
  if (statuses.size <= limit) return
  for (const [candidate, candidateStatus] of statuses) {
    if (candidateStatus !== 'loading') {
      statuses.delete(candidate)
      return
    }
  }
  const oldest = statuses.keys().next()
  if (oldest.done !== true) statuses.delete(oldest.value)
}

function countDelta(
  status: TileStatus,
  previous: TileStatus | undefined,
  next: TileStatus,
): number {
  return (next === status ? 1 : 0) - (previous === status ? 1 : 0)
}

/** Counts after one frame moved from `previous` to `next` status. */
export function applyTileStatusChange(
  counts: TileCounts,
  previous: TileStatus | undefined,
  next: TileStatus,
): TileCounts {
  if (previous === next) return counts
  return {
    requested: counts.requested + (previous === undefined ? 1 : 0),
    loaded: counts.loaded + countDelta('loaded', previous, next),
    failed: counts.failed + countDelta('failed', previous, next),
  }
}

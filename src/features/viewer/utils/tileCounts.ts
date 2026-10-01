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

interface FramePayload {
  sopInstanceUID?: unknown
  frameNumber?: unknown
}

function framePayload(detail: unknown): FramePayload | undefined {
  if (typeof detail !== 'object' || detail === null) return undefined
  const payload = (detail as { payload?: unknown }).payload
  return typeof payload === 'object' && payload !== null
    ? (payload as FramePayload)
    : undefined
}

/** SOP Instance UID of a DMV frame event's `detail`, if present. */
export function frameEventSopInstanceUID(detail: unknown): string | undefined {
  const uid = framePayload(detail)?.sopInstanceUID
  return typeof uid === 'string' && uid !== '' ? uid : undefined
}

/** "<SOPInstanceUID>-<frameNumber>" for a DMV frame event's `detail`. */
export function frameEventKey(detail: unknown): string | undefined {
  const uid = frameEventSopInstanceUID(detail)
  const frameNumber = framePayload(detail)?.frameNumber
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

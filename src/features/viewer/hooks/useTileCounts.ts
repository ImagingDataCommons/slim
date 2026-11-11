import { useEffect, useRef, useState } from 'react'

import { subscribeDomEvents } from '../services/dmvEvents'
import {
  applyTileStatusChange,
  frameEventKey,
  frameEventSopInstanceUID,
  INITIAL_TILE_COUNTS,
  nextTileStatus,
  recordTileStatus,
  type TileCounts,
  type TileEventKind,
  type TileStatus,
} from '../utils/tileCounts'

const FRAME_EVENTS: ReadonlyArray<readonly [string, TileEventKind]> = [
  ['dicommicroscopyviewer_frame_loading_started', 'started'],
  ['dicommicroscopyviewer_frame_loading_ended', 'ended'],
  ['dicommicroscopyviewer_frame_loading_error', 'error'],
]

interface KeyedCounts {
  resetKey: unknown
  counts: TileCounts
}

/**
 * Counts DMV frame requests since mount or the last `resetKey` change. Every
 * DMV viewer publishes on `document.body`, so events are filtered to
 * `sopInstanceUIDs` (the volume images) when given. Updates are batched per
 * animation frame because tile events arrive in bursts.
 */
export function useTileCounts(
  sopInstanceUIDs?: ReadonlySet<string>,
  resetKey?: unknown,
): TileCounts {
  const [state, setState] = useState<KeyedCounts>({
    resetKey,
    counts: INITIAL_TILE_COUNTS,
  })
  const allowedRef = useRef(sopInstanceUIDs)

  useEffect(() => {
    allowedRef.current = sopInstanceUIDs
  }, [sopInstanceUIDs])

  useEffect(() => {
    const statuses = new Map<string, TileStatus>()
    let pending = INITIAL_TILE_COUNTS
    let frameId: number | undefined

    const flush = (): void => {
      frameId = undefined
      setState({ resetKey, counts: pending })
    }
    const handle = (kind: TileEventKind, event: Event): void => {
      if (!(event instanceof CustomEvent)) return
      const detail: unknown = event.detail
      const allowed = allowedRef.current
      if (allowed !== undefined) {
        const uid = frameEventSopInstanceUID(detail)
        if (uid === undefined || !allowed.has(uid)) return
      }
      const key = frameEventKey(detail)
      if (key === undefined) return
      const previous = statuses.get(key)
      const next = nextTileStatus(previous, kind)
      recordTileStatus(statuses, key, next)
      pending = applyTileStatusChange(pending, previous, next)
      if (frameId === undefined) frameId = requestAnimationFrame(flush)
    }
    const unsubscribe = subscribeDomEvents(
      document.body,
      FRAME_EVENTS.map(
        ([type, kind]) =>
          [type, (event: Event): void => handle(kind, event)] as const,
      ),
    )

    return () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId)
      unsubscribe()
    }
  }, [resetKey])

  return Object.is(state.resetKey, resetKey)
    ? state.counts
    : INITIAL_TILE_COUNTS
}

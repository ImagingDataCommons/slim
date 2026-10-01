import { useEffect, useRef, useState } from 'react'

import {
  applyTileStatusChange,
  frameEventKey,
  frameEventSopInstanceUID,
  INITIAL_TILE_COUNTS,
  nextTileStatus,
  type TileCounts,
  type TileEventKind,
  type TileStatus,
} from '../utils/tileCounts'

const FRAME_EVENTS: Array<[string, TileEventKind]> = [
  ['dicommicroscopyviewer_frame_loading_started', 'started'],
  ['dicommicroscopyviewer_frame_loading_ended', 'ended'],
  ['dicommicroscopyviewer_frame_loading_error', 'error'],
]

/**
 * Counts DMV frame requests since mount; remount per viewer to reset. Every
 * DMV viewer publishes on `document.body`, so events are filtered to
 * `sopInstanceUIDs` (the volume images) when given. Updates are batched per
 * animation frame because tile events arrive in bursts.
 */
export function useTileCounts(
  sopInstanceUIDs?: ReadonlySet<string>,
): TileCounts {
  const [counts, setCounts] = useState<TileCounts>(INITIAL_TILE_COUNTS)
  const allowedRef = useRef(sopInstanceUIDs)
  allowedRef.current = sopInstanceUIDs

  useEffect(() => {
    const statuses = new Map<string, TileStatus>()
    let pending = INITIAL_TILE_COUNTS
    let frameId: number | undefined

    const flush = (): void => {
      frameId = undefined
      setCounts(pending)
    }
    const listeners = FRAME_EVENTS.map(([type, kind]) => {
      const listener = (event: Event): void => {
        const detail = (event as CustomEvent<unknown>).detail
        const allowed = allowedRef.current
        if (allowed !== undefined) {
          const uid = frameEventSopInstanceUID(detail)
          if (uid === undefined || !allowed.has(uid)) return
        }
        const key = frameEventKey(detail)
        if (key === undefined) return
        const previous = statuses.get(key)
        const next = nextTileStatus(previous, kind)
        statuses.set(key, next)
        pending = applyTileStatusChange(pending, previous, next)
        if (frameId === undefined) frameId = requestAnimationFrame(flush)
      }
      document.body.addEventListener(type, listener)
      return [type, listener] as const
    })

    return () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId)
      for (const [type, listener] of listeners) {
        document.body.removeEventListener(type, listener)
      }
    }
  }, [])

  return counts
}

import type React from 'react'
import { useEffect, useState } from 'react'

import { useMemoryMonitor } from '../../../hooks/useMemoryMonitor'
import { cn } from '../../../lib/utils'
import { formatGroupedNumber } from '../../../utils/displayFormat'

const BYTES_PER_GB = 1024 ** 3

interface TileCounts {
  loaded: number
  requested: number
}

/**
 * Counts DMV frame requests since mount; remount per viewer to reset. Updates
 * are batched per animation frame because tile events arrive in bursts.
 */
function useTileCounts(): TileCounts {
  const [counts, setCounts] = useState<TileCounts>({ loaded: 0, requested: 0 })

  useEffect(() => {
    const requested = new Set<string>()
    const loaded = new Set<string>()
    let frameId: number | undefined

    const flush = (): void => {
      frameId = undefined
      setCounts({ loaded: loaded.size, requested: requested.size })
    }
    const schedule = (): void => {
      if (frameId === undefined) frameId = requestAnimationFrame(flush)
    }
    const keyOf = (event: Event): string | undefined => {
      const payload = (event as CustomEvent).detail?.payload as
        | { sopInstanceUID?: string; frameNumber?: string | number }
        | undefined
      if (payload?.sopInstanceUID === undefined) return undefined
      return `${payload.sopInstanceUID}-${String(payload.frameNumber)}`
    }
    const onStarted = (event: Event): void => {
      const key = keyOf(event)
      if (key === undefined) return
      requested.add(key)
      schedule()
    }
    const onEnded = (event: Event): void => {
      const key = keyOf(event)
      if (key === undefined) return
      requested.add(key)
      loaded.add(key)
      schedule()
    }

    document.body.addEventListener(
      'dicommicroscopyviewer_frame_loading_started',
      onStarted,
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_frame_loading_ended',
      onEnded,
    )
    return () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId)
      document.body.removeEventListener(
        'dicommicroscopyviewer_frame_loading_started',
        onStarted,
      )
      document.body.removeEventListener(
        'dicommicroscopyviewer_frame_loading_ended',
        onEnded,
      )
    }
  }, [])

  return counts
}

function formatGigabytes(bytes: number): string {
  return (bytes / BYTES_PER_GB).toFixed(1)
}

export interface ViewerFooterProps {
  enableMemoryMonitoring: boolean
}

/** 28px status bar under the viewport: connection, tile progress, memory. */
export function ViewerFooter({
  enableMemoryMonitoring,
}: ViewerFooterProps): React.ReactElement {
  const tiles = useTileCounts()
  const memory = useMemoryMonitor(enableMemoryMonitoring)
  const used = memory?.usedJSHeapSize ?? null
  const limit = memory?.jsHeapSizeLimit ?? null
  const usage =
    used !== null && limit !== null && limit > 0
      ? Math.min(100, (used / limit) * 100)
      : null

  return (
    <footer className="flex h-footer flex-none items-center gap-4 border-t border-line bg-panel px-3.5 font-mono text-[11.5px] text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Connected
      </span>
      <span>
        Tiles {formatGroupedNumber(tiles.loaded)} /{' '}
        {formatGroupedNumber(tiles.requested)}
      </span>
      <span className="flex-1" />
      {enableMemoryMonitoring &&
        usage !== null &&
        used !== null &&
        limit !== null && (
          <span className="flex items-center gap-2">
            Memory
            <span className="block h-[5px] w-[90px] overflow-hidden rounded-[3px] bg-line-soft">
              <span
                className={cn(
                  'block h-full',
                  usage >= 90
                    ? 'bg-destructive'
                    : usage >= 75
                      ? 'bg-warning'
                      : 'bg-primary',
                )}
                style={{ width: `${usage}%` }}
              />
            </span>
            {formatGigabytes(used)} / {formatGigabytes(limit)} GB
          </span>
        )}
    </footer>
  )
}

import type React from 'react'

import { useMemoryMonitor } from '../../../hooks/useMemoryMonitor'
import { cn } from '../../../lib/utils'
import { formatGroupedNumber } from '../../../utils/displayFormat'
import { useTileCounts } from '../hooks/useTileCounts'
import {
  formatGigabytes,
  memoryUsageLevel,
  memoryUsagePercent,
} from '../utils/memory'

export interface ViewerFooterProps {
  enableMemoryMonitoring: boolean
  /** Volume image SOP Instance UIDs whose frames are counted */
  sopInstanceUIDs?: ReadonlySet<string>
  /** Tile counts restart whenever this changes (e.g. a viewer rebuild) */
  resetKey?: string
}

const MEMORY_BAR_TONE = {
  none: 'bg-primary',
  high: 'bg-warning',
  critical: 'bg-destructive',
} as const

/** 28px status bar under the viewport: tile progress and memory. */
export function ViewerFooter({
  enableMemoryMonitoring,
  sopInstanceUIDs,
  resetKey,
}: ViewerFooterProps): React.ReactElement {
  const tiles = useTileCounts(sopInstanceUIDs, resetKey)
  const memory = useMemoryMonitor(enableMemoryMonitoring)
  const used = memory?.usedJSHeapSize ?? null
  const limit = memory?.jsHeapSizeLimit ?? null
  const usage = memoryUsagePercent(used, limit)

  return (
    <footer className="flex h-footer flex-none items-center gap-4 border-t border-line bg-panel px-3.5 font-mono text-11.5 text-ink-muted">
      <span>
        Tiles {formatGroupedNumber(tiles.loaded)} /{' '}
        {formatGroupedNumber(tiles.requested)}
      </span>
      {tiles.failed > 0 && (
        <span className="text-destructive-text">
          {formatGroupedNumber(tiles.failed)} failed
        </span>
      )}
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
                  MEMORY_BAR_TONE[memoryUsageLevel(usage)],
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

/** Memory readout helpers for the viewer footer. */

import {
  CRITICAL_MEMORY_USAGE_PERCENT,
  HIGH_MEMORY_USAGE_PERCENT,
  type MemoryWarningLevel,
} from '../../../utils/memoryWarning'

const BYTES_PER_GB = 1024 ** 3

/** Used share of the heap limit in [0, 100], or `null` when unknown. */
export function memoryUsagePercent(
  used: number | null | undefined,
  limit: number | null | undefined,
): number | null {
  if (
    used === null ||
    used === undefined ||
    limit === null ||
    limit === undefined ||
    !Number.isFinite(used) ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return null
  }
  return Math.min(100, Math.max(0, (used / limit) * 100))
}

export function memoryUsageLevel(percent: number | null): MemoryWarningLevel {
  if (percent === null) return 'none'
  if (percent > CRITICAL_MEMORY_USAGE_PERCENT) return 'critical'
  if (percent > HIGH_MEMORY_USAGE_PERCENT) return 'high'
  return 'none'
}

/** 1.5 GiB → "1.5" */
export function formatGigabytes(bytes: number): string {
  return (bytes / BYTES_PER_GB).toFixed(1)
}

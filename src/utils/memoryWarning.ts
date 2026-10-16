/** Decides when a memory-usage warning should be published. */

export type MemoryWarningLevel = 'none' | 'high' | 'critical'

/** Usage strictly above these shares of the heap limit (%) raises the level. */
export const HIGH_MEMORY_USAGE_PERCENT = 80
export const CRITICAL_MEMORY_USAGE_PERCENT = 90

export interface MemoryWarningState {
  level: MemoryWarningLevel
  lastCriticalAt: number
}

export interface MemoryWarningInput {
  level: MemoryWarningLevel
  usagePercentage: number | null
  /** Human-readable remaining memory, e.g. "512 MB" */
  remaining: string
}

export interface MemoryWarningDecision {
  state: MemoryWarningState
  message: string | null
}

export interface MemoryUsageFlags {
  apiMethod: 'modern' | 'chrome' | 'unavailable'
  isHighUsage: boolean
  isCriticalUsage: boolean
}

export function memoryWarningLevel(
  memory: MemoryUsageFlags | null,
): MemoryWarningLevel {
  if (memory === null || memory.apiMethod === 'unavailable') return 'none'
  if (memory.isCriticalUsage) return 'critical'
  if (memory.isHighUsage) return 'high'
  return 'none'
}

const BYTE_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB']

/** Binary (1024-based) size with two decimals, e.g. "1.50 KB" */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'N/A'
  if (bytes === 0) return '0 Bytes'
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  )
  return `${(bytes / 1024 ** exponent).toFixed(2)} ${BYTE_UNITS[exponent]}`
}

export const CRITICAL_WARNING_THROTTLE_MS = 30000

export const INITIAL_MEMORY_WARNING_STATE: MemoryWarningState = {
  level: 'none',
  lastCriticalAt: Number.NEGATIVE_INFINITY,
}

/**
 * Warn only when the level changes; critical warnings are additionally
 * throttled so oscillating around the threshold does not spam the user.
 */
export function evaluateMemoryWarning(
  input: MemoryWarningInput,
  state: MemoryWarningState,
  now: number,
  throttleMs: number = CRITICAL_WARNING_THROTTLE_MS,
): MemoryWarningDecision {
  if (input.level === state.level) return { state, message: null }
  const nextState: MemoryWarningState = { ...state, level: input.level }
  if (input.usagePercentage === null) {
    return { state: nextState, message: null }
  }
  const percentage = input.usagePercentage.toFixed(1)
  if (input.level === 'critical') {
    if (now - state.lastCriticalAt < throttleMs) {
      return { state: nextState, message: null }
    }
    return {
      state: { ...nextState, lastCriticalAt: now },
      message:
        `Critical memory usage: ${percentage}% used. ` +
        `Only ${input.remaining} remaining. ` +
        'Consider refreshing the page or closing other tabs.',
    }
  }
  if (input.level === 'high') {
    return {
      state: nextState,
      message: `High memory usage: ${percentage}% used. ${input.remaining} remaining.`,
    }
  }
  return { state: nextState, message: null }
}

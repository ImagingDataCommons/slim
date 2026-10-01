/** Decides when a memory-usage warning should be published. */

export type MemoryWarningLevel = 'none' | 'high' | 'critical'

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

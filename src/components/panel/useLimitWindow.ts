import { clampLimitValues, type LimitSide } from '../../utils/limits'
import { useResettableState } from './useResettableState'

export type LimitValues = [number, number]

export interface UseLimitWindowOptions {
  /** Starting `[lower, upper]` window; no window when undefined */
  initial: readonly number[] | undefined
  min: number
  max: number
  onCommit: (values: LimitValues) => void
  /** Called with clamped values while previewing, e.g. for live feedback */
  onPreview?: (values: LimitValues) => void
  /** Restart from `initial` when this changes */
  resetKey?: string
}

export interface LimitWindow {
  values: LimitValues | undefined
  /** Clamp and show values without committing (slider drag) */
  preview: (values: readonly number[]) => void
  /** Clamp, show and commit values (slider release) */
  commit: (values: readonly number[]) => void
  commitLower: (value: number) => void
  commitUpper: (value: number) => void
}

function toLimitValues(
  values: readonly number[] | undefined,
): LimitValues | undefined {
  if (values === undefined || values.length < 2) return undefined
  return [values[0], values[1]]
}

/** Values-of-interest window kept inside `[min, max]` with lower <= upper. */
export function useLimitWindow({
  initial,
  min,
  max,
  onCommit,
  onPreview,
  resetKey,
}: UseLimitWindowOptions): LimitWindow {
  const [values, setValues] = useResettableState(
    toLimitValues(initial),
    resetKey,
  )

  const apply = (
    next: readonly number[],
    edited: LimitSide,
    shouldCommit: boolean,
  ): void => {
    const clamped = clampLimitValues([next[0], next[1]], min, max, edited)
    setValues(() => clamped)
    if (shouldCommit) {
      onCommit(clamped)
    } else {
      onPreview?.(clamped)
    }
  }

  return {
    values,
    preview: (next) => apply(next, 'lower', false),
    commit: (next) => apply(next, 'lower', true),
    commitLower: (value) => {
      if (values !== undefined) apply([value, values[1]], 'lower', true)
    },
    commitUpper: (value) => {
      if (values !== undefined) apply([values[0], value], 'upper', true)
    },
  }
}

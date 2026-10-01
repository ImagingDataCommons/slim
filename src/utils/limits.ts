export type LimitSide = 'lower' | 'upper'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Clamps a `[lower, upper]` window into `[min, max]` and keeps
 * `lower <= upper`. The `edited` side yields to the other one when they cross.
 */
export function clampLimitValues(
  [lower, upper]: readonly [number, number] | number[],
  min: number,
  max: number,
  edited: LimitSide = 'lower',
): [number, number] {
  const low = Math.min(min, max)
  const high = Math.max(min, max)
  let nextLower = clamp(Number.isFinite(lower) ? lower : low, low, high)
  let nextUpper = clamp(Number.isFinite(upper) ? upper : high, low, high)
  if (nextLower > nextUpper) {
    if (edited === 'upper') {
      nextUpper = nextLower
    } else {
      nextLower = nextUpper
    }
  }
  return [nextLower, nextUpper]
}

/** Parses limit input text; undefined for empty or non-numeric input */
export function parseLimitInput(
  text: string,
  integer = false,
): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const value = integer
    ? Number.parseInt(trimmed, 10)
    : Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : undefined
}

/** Restricts `value` to `[min, max]`; NaN falls back to `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

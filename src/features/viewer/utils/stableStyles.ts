import { areStylesEqual } from '../../../utils/styleEquality'

/**
 * `next` with every entry equal to its `previous` counterpart replaced by the
 * previous object, or `previous` itself when no entry changed, so panels get
 * the same style map back when the viewer styles did not change.
 */
export function reuseEqualStyles<T extends object>(
  previous: Readonly<Record<string, T>>,
  next: Readonly<Record<string, T>>,
): Readonly<Record<string, T>> {
  const keys = Object.keys(next)
  let isUnchanged = keys.length === Object.keys(previous).length
  const result: Record<string, T> = {}
  for (const key of keys) {
    const previousStyle = Object.hasOwn(previous, key)
      ? previous[key]
      : undefined
    if (
      previousStyle !== undefined &&
      areStylesEqual(previousStyle, next[key])
    ) {
      result[key] = previousStyle
    } else {
      result[key] = next[key]
      isUnchanged = false
    }
  }
  return isUnchanged ? previous : result
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
    )
  }
  return false
}

/**
 * Shallow equality of two style objects where array values (colors, limit
 * windows) are compared element-wise and other values by identity.
 */
export function areStylesEqual(
  a: object | undefined,
  b: object | undefined,
): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  const entriesA = Object.entries(a)
  if (entriesA.length !== Object.keys(b).length) return false
  return entriesA.every(
    ([key, value]) =>
      Object.hasOwn(b, key) && areValuesEqual(value, Reflect.get(b, key)),
  )
}

/**
 * `React.memo` comparator for layer items: props are compared by identity,
 * except `defaultStyle`, which callers rebuild on every render.
 */
export function areLayerItemPropsEqual<P extends { defaultStyle: object }>(
  previous: P,
  next: P,
): boolean {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const key of keys) {
    const a: unknown = Reflect.get(previous, key)
    const b: unknown = Reflect.get(next, key)
    if (key === 'defaultStyle') {
      if (!areStylesEqual(previous.defaultStyle, next.defaultStyle)) {
        return false
      }
    } else if (!Object.is(a, b)) {
      return false
    }
  }
  return true
}

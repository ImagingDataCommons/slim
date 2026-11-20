/** `previous` when `next` holds the same items in the same order, else `next` */
export function reuseIdenticalArray<T>(previous: T[], next: T[]): T[] {
  if (previous.length !== next.length) return next
  for (let i = 0; i < next.length; i++) {
    if (!Object.is(previous[i], next[i])) return next
  }
  return previous
}

function reuseRecord<T>(
  previous: Record<string, T>,
  next: Record<string, T>,
  isSame: (a: T, b: T) => boolean,
): Record<string, T> {
  const keys = Object.keys(next)
  if (keys.length !== Object.keys(previous).length) return next
  for (const key of keys) {
    if (!Object.hasOwn(previous, key) || !isSame(previous[key], next[key])) {
      return next
    }
  }
  return previous
}

/** `previous` when `next` maps the same keys to identical values, else `next` */
export function reuseIdenticalRecord<T>(
  previous: Record<string, T>,
  next: Record<string, T>,
): Record<string, T> {
  return reuseRecord(previous, next, Object.is)
}

/**
 * `previous` when `next` maps the same keys to arrays holding identical
 * items, else `next`. For getters that return a new array on every call.
 */
export function reuseIdenticalArrayRecord<T>(
  previous: Record<string, T[]>,
  next: Record<string, T[]>,
): Record<string, T[]> {
  return reuseRecord(previous, next, (a, b) => reuseIdenticalArray(a, b) === a)
}

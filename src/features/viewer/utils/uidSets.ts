/** Copy of `set` with `item` added */
export function withItem<T>(set: ReadonlySet<T>, item: T): Set<T> {
  return new Set(set).add(item)
}

/** Copy of `set` without `item` */
export function withoutItem<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set)
  next.delete(item)
  return next
}

/** Copy of `set` with every item of `items` added */
export function withItems<T>(set: ReadonlySet<T>, items: Iterable<T>): Set<T> {
  return new Set([...set, ...items])
}

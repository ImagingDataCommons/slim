/**
 * Pair each item with a React key built from `getBase(item)` plus how many
 * times that base appeared before, so repeated values still get unique,
 * order-stable keys without relying on the array index.
 */
export function withOccurrenceKeys<T>(
  items: readonly T[],
  getBase: (item: T) => string,
): Array<{ item: T; key: string }> {
  const occurrences = new Map<string, number>()
  return items.map((item) => {
    const base = getBase(item)
    const count = occurrences.get(base) ?? 0
    occurrences.set(base, count + 1)
    return { item, key: `${base}#${count}` }
  })
}

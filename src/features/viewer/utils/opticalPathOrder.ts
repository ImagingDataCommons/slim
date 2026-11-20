/** Copy of `items` sorted by `identifier` in locale order */
export function sortByIdentifier<T extends { identifier: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.identifier.localeCompare(b.identifier) === 1) {
      return 1
    } else if (b.identifier.localeCompare(a.identifier) === 1) {
      return -1
    }
    return 0
  })
}

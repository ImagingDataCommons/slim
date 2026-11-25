/**
 * Maps `items` through an async `mapper` with at most `limit` calls in
 * flight, resolving to results in input order. A NaN or sub-1 `limit` runs
 * the items one at a time; `Infinity` runs them all at once.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }
  const safeLimit = Number.isNaN(limit) || limit < 1 ? 1 : Math.floor(limit)
  const workerCount = Math.min(safeLimit, items.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

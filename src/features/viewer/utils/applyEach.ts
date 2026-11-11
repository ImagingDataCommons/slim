/**
 * Run `apply` on each item in order and hand the results that succeeded to
 * `onSettled`, also when an item throws (the error is rethrown afterwards).
 * Lets hooks report partial viewer updates without a `try/finally` of their
 * own, which React Compiler cannot compile.
 */
export function applyEach<T, R>(
  items: Iterable<T>,
  apply: (item: T) => R,
  onSettled: (applied: R[]) => void,
): void {
  const applied: R[] = []
  try {
    for (const item of items) {
      applied.push(apply(item))
    }
  } finally {
    onSettled(applied)
  }
}

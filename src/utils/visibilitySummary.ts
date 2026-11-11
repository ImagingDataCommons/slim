/** Spoken visibility state of a set of items, e.g. "3 of 5 visible". */
export function formatVisibilitySummary(
  visibleCount: number,
  total: number,
): string {
  if (total > 0 && visibleCount >= total) return 'all visible'
  if (visibleCount <= 0) return 'hidden'
  return `${visibleCount} of ${total} visible`
}

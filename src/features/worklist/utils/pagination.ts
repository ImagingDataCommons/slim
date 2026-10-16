/** Pure page math for the worklist footer. */

export interface PageRange {
  pageCount: number
  /** 1-based index of the first visible item, 0 when there are none */
  startItem: number
  /** 1-based index of the last visible item, 0 when there are none */
  endItem: number
}

export function clampPageIndex(pageIndex: number, pageCount: number): number {
  return Math.min(Math.max(pageIndex, 0), Math.max(pageCount - 1, 0))
}

export function getPageRange(
  pageIndex: number,
  pageSize: number,
  total: number,
): PageRange {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))
  if (total <= 0) return { pageCount, startItem: 0, endItem: 0 }
  const index = clampPageIndex(pageIndex, pageCount)
  return {
    pageCount,
    startItem: index * pageSize + 1,
    endItem: Math.min((index + 1) * pageSize, total),
  }
}

/**
 * Pagination with the page index moved onto the last page when the list
 * shrank below it; returns the same object when it is already valid.
 */
export function clampPagination<
  T extends { pageIndex: number; pageSize: number },
>(pagination: T, total: number): T {
  const { pageCount } = getPageRange(
    pagination.pageIndex,
    pagination.pageSize,
    total,
  )
  const pageIndex = clampPageIndex(pagination.pageIndex, pageCount)
  return pageIndex === pagination.pageIndex
    ? pagination
    : { ...pagination, pageIndex }
}

/**
 * Page numbers to show around the current page: first, last and a window of
 * neighbours, with `null` marking elided gaps.
 */
export function getVisiblePages(
  pageIndex: number,
  pageCount: number,
): Array<number | null> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index)
  }
  const pages = new Set<number>([0, pageCount - 1])
  for (let index = pageIndex - 1; index <= pageIndex + 1; index++) {
    if (index > 0 && index < pageCount - 1) pages.add(index)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const result: Array<number | null> = []
  sorted.forEach((page, position) => {
    if (position > 0 && page - sorted[position - 1] > 1) result.push(null)
    result.push(page)
  })
  return result
}

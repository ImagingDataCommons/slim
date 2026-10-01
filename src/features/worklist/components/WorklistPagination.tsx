import type { PaginationState } from '@tanstack/react-table'
import type * as React from 'react'

import { Icon } from '../../../components/ui/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { cn } from '../../../lib/utils'
import {
  clampPageIndex,
  getPageRange,
  getVisiblePages,
} from '../utils/pagination'

interface WorklistPaginationProps {
  pagination: PaginationState
  totalCount: number
  onPaginationChange: (pagination: PaginationState) => void
  pageSizeOptions?: number[]
  className?: string
}

const PAGE_BUTTON =
  'grid h-[30px] min-w-[30px] place-items-center rounded-md border px-1.5 text-[12.5px] transition-colors'

/** 48px table footer: range summary, rows-per-page and page buttons. */
export function WorklistPagination({
  pagination,
  totalCount,
  onPaginationChange,
  pageSizeOptions = [20, 50, 100, 200, 500],
  className,
}: WorklistPaginationProps): React.ReactElement {
  const { pageIndex, pageSize } = pagination
  const { pageCount, startItem, endItem } = getPageRange(
    pageIndex,
    pageSize,
    totalCount,
  )
  const goTo = (index: number): void => {
    onPaginationChange({
      ...pagination,
      pageIndex: clampPageIndex(index, pageCount),
    })
  }

  return (
    <div
      className={cn(
        'flex h-12 flex-none items-center gap-3 border-t border-line pl-5 pr-4 text-[12.5px] text-ink-muted',
        className,
      )}
    >
      <div>
        Showing {startItem}–{endItem} of {totalCount}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        Rows per page
        <Select
          value={String(pageSize)}
          onValueChange={(value) =>
            onPaginationChange({ pageIndex: 0, pageSize: Number(value) })
          }
        >
          <SelectTrigger
            aria-label="Rows per page"
            className="h-[30px] w-[68px] rounded-md pl-2.5 pr-1.5 text-ink"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav aria-label="Pagination" className="flex gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={pageIndex === 0}
          onClick={() => goTo(pageIndex - 1)}
          className={cn(
            PAGE_BUTTON,
            'border-line-input bg-panel text-ink-body hover:bg-app disabled:pointer-events-none disabled:text-ink-fainter',
          )}
        >
          <Icon name="chevron_left" size={18} />
        </button>
        {getVisiblePages(pageIndex, pageCount).map((page, position, pages) =>
          page === null ? (
            <span
              key={`gap-after-${String(pages[position - 1])}`}
              className="grid h-[30px] w-5 place-items-center text-ink-faint"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              aria-current={page === pageIndex ? 'page' : undefined}
              onClick={() => goTo(page)}
              className={cn(
                PAGE_BUTTON,
                page === pageIndex
                  ? 'border-primary bg-primary-soft font-semibold text-primary'
                  : 'border-line-input bg-panel font-medium text-ink-body hover:bg-app',
              )}
            >
              {page + 1}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => goTo(pageIndex + 1)}
          className={cn(
            PAGE_BUTTON,
            'border-line-input bg-panel text-ink-body hover:bg-app disabled:pointer-events-none disabled:text-ink-fainter',
          )}
        >
          <Icon name="chevron_right" size={18} />
        </button>
      </nav>
    </div>
  )
}

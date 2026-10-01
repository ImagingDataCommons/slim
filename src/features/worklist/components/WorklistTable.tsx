import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import * as React from 'react'

import { Icon } from '../../../components/ui/icon'
import { cn } from '../../../lib/utils'
import {
  columns,
  WORKLIST_GRID_COLUMNS,
  type WorklistColumnMeta,
} from './columns'

interface WorklistTableProps {
  data: dmv.metadata.Study[]
  isLoading: boolean
  searchText: string
  isCompact: boolean
  onRowClick: (study: dmv.metadata.Study) => void
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  /** Rendered under the rows (pagination bar) */
  footer?: React.ReactNode
  className?: string
}

/** Studies grid: sticky uppercase header, 48px rows, footer slot. */
export function WorklistTable({
  data,
  isLoading,
  searchText,
  isCompact,
  onRowClick,
  pagination,
  onPaginationChange,
  footer,
  className,
}: WorklistTableProps): React.ReactElement {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'StudyDate', desc: true },
  ])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      onPaginationChange(
        typeof updater === 'function' ? updater(pagination) : updater,
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.StudyInstanceUID,
  })

  const statusRow = (content: React.ReactNode): React.ReactNode => (
    <tr className="block">
      <td colSpan={columns.length} className="block px-5 py-16 text-ink-muted">
        {content}
      </td>
    </tr>
  )

  let body: React.ReactNode
  if (isLoading) {
    body = statusRow(
      <span className="flex flex-col items-center gap-3">
        <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        Loading studies…
      </span>,
    )
  } else if (data.length === 0) {
    body = statusRow(
      <span className="block text-center">
        {searchText.trim() !== ''
          ? `No studies match “${searchText.trim()}”.`
          : 'No studies found.'}
      </span>,
    )
  } else {
    body = table.getRowModel().rows.map((row) => (
      <tr
        key={row.id}
        tabIndex={0}
        onClick={() => onRowClick(row.original)}
        onKeyDown={(event) => {
          if (event.key === ' ') event.preventDefault()
          if (event.key === 'Enter' || event.key === ' ') {
            onRowClick(row.original)
          }
        }}
        className={cn(
          'grid cursor-pointer items-center gap-3 border-b border-line-soft px-5 text-ink-body transition-colors hover:bg-selected focus-visible:bg-selected focus-visible:outline-none',
          WORKLIST_GRID_COLUMNS,
          isCompact ? 'h-10' : 'h-12',
        )}
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className="min-w-0">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    ))
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-panel',
        className,
      )}
    >
      <table className="flex min-h-0 flex-1 flex-col text-left">
        <thead className="block flex-none">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className={cn(
                'grid h-10 items-center gap-3 border-b border-line bg-subtle px-5 text-[11px] font-semibold uppercase leading-none tracking-[0.05em] text-ink-muted',
                WORKLIST_GRID_COLUMNS,
              )}
            >
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                const canSort = header.column.getCanSort()
                const meta = header.column.columnDef.meta as
                  | WorklistColumnMeta
                  | undefined
                const label = flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : undefined
                    }
                    className={cn(
                      'min-w-0 text-left font-semibold',
                      meta?.align === 'right' && 'text-right',
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1 uppercase tracking-[0.05em] transition-colors hover:text-ink',
                          sorted !== false && 'text-primary hover:text-primary',
                          meta?.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        <span className="truncate">{label}</span>
                        {sorted !== false && (
                          <Icon
                            name={
                              sorted === 'desc'
                                ? 'arrow_downward'
                                : 'arrow_upward'
                            }
                            size={15}
                          />
                        )}
                      </button>
                    ) : (
                      <span className="block truncate">{label}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className="block min-h-0 flex-1 overflow-auto">{body}</tbody>
      </table>
      {footer}
    </div>
  )
}

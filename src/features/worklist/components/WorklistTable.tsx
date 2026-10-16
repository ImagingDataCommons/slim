/**
 * Div grid + ARIA table roles: real <table>/<tr> fight CSS grid track sizing.
 * Biome prefers semantic tags / focusable interactive roles; suppress those here.
 */
// biome-ignore-all lint/a11y/useSemanticElements: intentional ARIA table on divs for CSS grid
// biome-ignore-all lint/a11y/useFocusableInteractive: only data rows are keyboard targets
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import * as React from 'react'

import { Icon } from '../../../components/ui/icon'
import { Skeleton } from '../../../components/ui/skeleton'
import { cn } from '../../../lib/utils'
import {
  columnVisibilityForTier,
  useWorklistColumnLayout,
  WORKLIST_GRID_TEMPLATE_BY_TIER,
  type WorklistWidthTier,
} from '../hooks/useWorklistColumnLayout'
import { columns } from './columns'

export interface WorklistTableProps {
  data: dmv.metadata.Study[]
  isLoading: boolean
  /** Shown instead of rows when `data` is empty */
  emptyMessage: string
  isCompact: boolean
  onRowClick: (study: dmv.metadata.Study) => void
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  /** Rendered under the rows (pagination bar) */
  footer?: React.ReactNode
  /** Study UIDs on the current page, after sorting */
  onPageRowsChange?: (studyUids: readonly string[]) => void
  /** Small status drawn in the row's left gutter */
  renderRowMarker?: (study: dmv.metadata.Study) => React.ReactNode
  className?: string
}

const NO_ROWS: readonly string[] = []

const SKELETON_MAX_ROWS = 12

/** Bar widths cycled across cells so the placeholder reads like real data */
const SKELETON_BAR_WIDTHS = [
  'w-3/4',
  'w-1/2',
  'w-2/3',
  'w-5/6',
  'w-2/5',
  'w-3/5',
  'w-4/5',
]

function rowHeightClass(isCompact: boolean): string {
  /** min-height so wrapped modality chips grow the row instead of overlapping */
  return isCompact ? 'min-h-8 py-1' : 'min-h-9 py-1.5'
}

function visibleColumnsForTier(tier: WorklistWidthTier) {
  const visibility = columnVisibilityForTier(tier)
  return columns.filter((column) => {
    const id = column.id
    if (id === undefined) return true
    return visibility[id] !== false
  })
}

function WorklistSkeletonRows({
  rowCount,
  isCompact,
  tier,
  gridStyle,
}: {
  rowCount: number
  isCompact: boolean
  tier: WorklistWidthTier
  gridStyle: React.CSSProperties
}): React.ReactElement {
  const rowIndexes = Array.from({ length: rowCount }, (_, index) => index)
  const visibleColumns = visibleColumnsForTier(tier)
  return (
    <>
      <div role="row" className="sr-only">
        <div role="cell">Loading studies…</div>
      </div>
      {rowIndexes.map((rowIndex) => (
        <div
          key={`skeleton-${rowIndex}`}
          role="row"
          aria-hidden="true"
          className={cn(
            'grid w-full min-w-0 items-center gap-2 border-b border-line-soft px-5 sm:gap-3',
            rowHeightClass(isCompact),
          )}
          style={{
            ...gridStyle,
            opacity: 1 - rowIndex / (rowCount + 4),
          }}
        >
          {visibleColumns.map((column, columnIndex) => {
            const width =
              SKELETON_BAR_WIDTHS[
                (rowIndex * 3 + columnIndex) % SKELETON_BAR_WIDTHS.length
              ]
            return (
              <div
                key={column.id ?? columnIndex}
                role="cell"
                className={cn(
                  'flex min-w-0',
                  column.meta?.align === 'right' && 'justify-end',
                )}
              >
                <Skeleton
                  className={width}
                  style={{ animationDelay: `${rowIndex * 60}ms` }}
                />
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}

/** Studies grid: sticky uppercase header, growing rows, footer slot. */
export function WorklistTable({
  data,
  isLoading,
  emptyMessage,
  isCompact,
  onRowClick,
  pagination,
  onPaginationChange,
  footer,
  onPageRowsChange,
  renderRowMarker,
  className,
}: WorklistTableProps): React.ReactElement {
  /**
   * TanStack Table returns a mutable table instance whose getters change
   * without a new identity, so memoizing this component would render stale
   * rows. React Compiler lists useReactTable as an incompatible library.
   */
  'use no memo'
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  const tier = useWorklistColumnLayout(container)
  const columnVisibility = columnVisibilityForTier(tier)
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: WORKLIST_GRID_TEMPLATE_BY_TIER[tier],
  }

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'StudyDate', desc: true },
  ])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination, columnVisibility },
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

  const pageRowsKey = isLoading
    ? ''
    : table
        .getRowModel()
        .rows.map((row) => row.id)
        .join('|')
  React.useEffect(() => {
    onPageRowsChange?.(pageRowsKey === '' ? NO_ROWS : pageRowsKey.split('|'))
  }, [pageRowsKey, onPageRowsChange])

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <WorklistSkeletonRows
        rowCount={Math.min(pagination.pageSize, SKELETON_MAX_ROWS)}
        isCompact={isCompact}
        tier={tier}
        gridStyle={gridStyle}
      />
    )
  } else if (data.length === 0) {
    body = (
      <div role="row" className="block">
        <div
          role="cell"
          className="block px-5 py-16 text-center text-ink-muted"
        >
          {emptyMessage}
        </div>
      </div>
    )
  } else {
    body = table.getRowModel().rows.map((row) => (
      <div
        key={row.id}
        role="row"
        tabIndex={0}
        onClick={() => onRowClick(row.original)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onRowClick(row.original)
          }
        }}
        className={cn(
          'relative grid w-full min-w-0 max-w-full cursor-pointer items-center gap-2 border-b border-line-soft px-5 text-ink-body transition-colors focus-within:bg-selected hover:bg-selected sm:gap-3',
          rowHeightClass(isCompact),
        )}
        style={gridStyle}
      >
        {renderRowMarker !== undefined && (
          <div className="pointer-events-none absolute left-1.5 top-1/2 flex -translate-y-1/2">
            {renderRowMarker(row.original)}
          </div>
        )}
        {row.getVisibleCells().map((cell) => (
          <div key={cell.id} role="cell" className="min-w-0 overflow-hidden">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ))}
      </div>
    ))
  }

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-card border border-line bg-panel',
        className,
      )}
    >
      {/** Measured width drives TanStack visibility + matching grid tracks. */}
      <div
        ref={setContainer}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div role="table" className="w-full min-w-0 max-w-full text-left">
          <div role="rowgroup" className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <div
                key={headerGroup.id}
                role="row"
                className="grid h-8 w-full min-w-0 max-w-full items-center gap-2 border-b border-line bg-subtle px-5 text-11 font-semibold uppercase leading-none tracking-wider text-ink-muted sm:gap-3"
                style={gridStyle}
              >
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  const meta = header.column.columnDef.meta
                  const label = flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )
                  return (
                    <div
                      key={header.id}
                      role="columnheader"
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className={cn(
                        'min-w-0 overflow-hidden text-left font-semibold',
                        meta?.align === 'right' && 'text-right',
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex max-w-full items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink',
                            sorted !== false &&
                              'text-primary hover:text-primary',
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
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div role="rowgroup" aria-busy={isLoading}>
            {body}
          </div>
        </div>
      </div>
      {footer}
    </div>
  )
}

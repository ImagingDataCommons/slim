import type * as React from 'react'

import { SearchInput } from '../../../components/ui/search-input'
import { useLayoutMode } from '../../../contexts/LayoutModeContext'
import { cn } from '../../../lib/utils'
import type { ContainsSearchStatus } from '../hooks/useContainsSearch'
import type { WorklistWidthTier } from '../hooks/useWorklistColumnLayout'
import { isCardLayout } from '../hooks/useWorklistColumnLayout'
import type { ContainsEntry } from '../utils/containsCatalog'
import { ColumnsPicker } from './ColumnsPicker'
import { ContainsPicker } from './ContainsPicker'

export interface WorklistContainsState {
  entry: ContainsEntry
  status: Exclude<ContainsSearchStatus, 'idle'>
  /** Pages received so far while searching */
  pages: number
  /** Studies left after the filter, before the text search */
  matchCount: number
  /** Some matches are not checked yet, so the count may still drop */
  isApproximate: boolean
  isPartial: boolean
  /** Raw QIDO study hits, before confirmation drops mismatches */
  searchedCount: number
  onRetry: () => void
  onLoadMore: () => void
  canLoadMore: boolean
  /** The last page could not be fetched from every server */
  hasStoreFailures?: boolean
}

export interface WorklistHeaderProps {
  isLoading: boolean
  searchText: string
  onSearchChange: (value: string) => void
  contains?: WorklistContainsState
  /**
   * Contains entry from the URL, even when it cannot be searched (no server
   * for its SOP class), so the chip and its clear button always show
   */
  containsEntry?: ContainsEntry
  onContainsChange: (entry: ContainsEntry | undefined) => void
  /** Current width tier for the Columns picker eligibility. */
  columnTier: WorklistWidthTier
  /** Column ids the user has turned off. */
  hiddenColumnIds: readonly string[]
  className?: string
}

const studies = (count: number): string => (count === 1 ? 'study' : 'studies')

function ContainsSummary({
  contains,
}: {
  contains: WorklistContainsState
}): React.ReactElement {
  const {
    entry,
    status,
    pages,
    matchCount,
    isApproximate,
    isPartial,
    searchedCount,
    onRetry,
    onLoadMore,
    canLoadMore,
    hasStoreFailures = false,
  } = contains
  if (status === 'searching' && matchCount === 0) {
    return (
      <>
        Searching the server for {entry.label}…
        {pages > 0 && ` page ${pages + 1}`}
      </>
    )
  }
  if (status === 'error') {
    return (
      <span className="text-destructive-text">
        Couldn't search for {entry.label}.{' '}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Retry
        </button>
      </span>
    )
  }
  const linkClass =
    'rounded-sm font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40'
  return (
    <>
      {isApproximate && 'Up to '}
      {matchCount} {studies(matchCount)} with {entry.label}
      {isPartial &&
        ` · first ${searchedCount.toLocaleString('en-US')} matches only`}
      {status === 'searching' && ' · searching…'}
      {hasStoreFailures && (
        <span className="text-warning">
          {' · '}some servers could not be searched
        </span>
      )}
      {canLoadMore && (
        <>
          {' · '}
          <button type="button" onClick={onLoadMore} className={linkClass}>
            Search more
          </button>
        </>
      )}
    </>
  )
}

/** "Studies" title, optional status line, "Contains" filter and search field. */
export function WorklistHeader({
  isLoading,
  searchText,
  onSearchChange,
  contains,
  containsEntry: containsEntryProp,
  onContainsChange,
  columnTier,
  hiddenColumnIds,
  className,
}: WorklistHeaderProps): React.ReactElement {
  const { compactChrome, overlayPanels } = useLayoutMode()
  const containsEntry = containsEntryProp ?? contains?.entry
  const showColumns = !isCardLayout(columnTier)
  /** Search drops to its own row below `lg` so the toolbar cannot collapse it. */
  const stackedSearch = compactChrome || overlayPanels
  const status =
    isLoading && contains === undefined ? (
      'Loading studies…'
    ) : contains !== undefined ? (
      <ContainsSummary contains={contains} />
    ) : containsEntry !== undefined ? (
      `${containsEntry.label} can't be searched on this server.`
    ) : undefined

  const search = (
    <SearchInput
      aria-label="Search studies"
      placeholder="Search patient, ID, accession…"
      value={searchText}
      onValueChange={onSearchChange}
      clearable
      className={cn(
        'min-w-0 w-full',
        compactChrome && 'h-11',
        stackedSearch ? 'max-w-none' : 'max-w-[340px]',
      )}
      inputClassName={cn(
        'placeholder:text-ink-faint',
        compactChrome && 'text-[16px]',
      )}
    />
  )

  return (
    <div className={cn('flex min-w-0 w-full flex-col gap-2', className)}>
      {/**
       * Title and tools share one wrap row. Status sits underneath so a
       * mid-width toolbar cannot squeeze it into a single-word column.
       */}
      <div className="flex min-w-0 w-full flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="flex-none text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
          Studies
        </h1>
        <div
          className={cn(
            'flex min-w-0 items-center gap-2',
            compactChrome ? 'ml-auto flex-none' : 'ml-auto flex-1 justify-end',
          )}
        >
          {showColumns && (
            <ColumnsPicker
              tier={columnTier}
              hiddenColumnIds={hiddenColumnIds}
            />
          )}
          <ContainsPicker
            value={containsEntry}
            onChange={onContainsChange}
            isBusy={contains?.status === 'searching'}
            compact={compactChrome}
          />
          {!stackedSearch && search}
        </div>
        {stackedSearch && <div className="w-full min-w-0">{search}</div>}
      </div>
      {status !== undefined && (
        <div className="min-w-0 text-12.5 text-ink-muted" aria-live="polite">
          {status}
        </div>
      )}
    </div>
  )
}

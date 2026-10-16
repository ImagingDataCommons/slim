import type * as React from 'react'

import { SearchInput } from '../../../components/ui/search-input'
import { cn } from '../../../lib/utils'
import type { ContainsSearchStatus } from '../hooks/useContainsSearch'
import type { WorklistWidthTier } from '../hooks/useWorklistColumnLayout'
import type { ContainsEntry } from '../utils/containsCatalog'
import { CONTAINS_MAX_PAGES, CONTAINS_PAGE_SIZE } from '../utils/containsSearch'
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
  onRetry: () => void
}

export interface WorklistHeaderProps {
  isLoading: boolean
  searchText: string
  onSearchChange: (value: string) => void
  contains?: WorklistContainsState
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
    onRetry,
  } = contains
  if (status === 'searching') {
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
  return (
    <>
      {isApproximate && 'Up to '}
      {matchCount} {studies(matchCount)} with {entry.label}
      {isPartial &&
        ` · first ${(CONTAINS_PAGE_SIZE * CONTAINS_MAX_PAGES).toLocaleString('en-US')} matches only`}
    </>
  )
}

/** "Studies" title, optional status line, "Contains" filter and search field. */
export function WorklistHeader({
  isLoading,
  searchText,
  onSearchChange,
  contains,
  onContainsChange,
  columnTier,
  hiddenColumnIds,
  className,
}: WorklistHeaderProps): React.ReactElement {
  const status =
    isLoading && contains === undefined ? (
      'Loading studies…'
    ) : contains !== undefined ? (
      <ContainsSummary contains={contains} />
    ) : undefined

  return (
    <div
      className={cn(
        'flex min-w-0 w-full flex-wrap items-center gap-x-4 gap-y-2',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="flex-none text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
          Studies
        </h1>
        {status !== undefined && (
          <div
            className="min-w-0 truncate text-12.5 text-ink-muted"
            aria-live="polite"
          >
            {status}
          </div>
        )}
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
        <ColumnsPicker tier={columnTier} hiddenColumnIds={hiddenColumnIds} />
        <ContainsPicker
          value={contains?.entry}
          onChange={onContainsChange}
          isBusy={contains?.status === 'searching'}
        />
        <SearchInput
          aria-label="Search studies"
          placeholder="Search patient, ID, accession…"
          value={searchText}
          onValueChange={onSearchChange}
          clearable
          className="min-w-0 w-full max-w-[340px] sm:w-[340px]"
          inputClassName="placeholder:text-ink-faint"
        />
      </div>
    </div>
  )
}

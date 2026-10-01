import type * as React from 'react'

import { SearchInput } from '../../../components/ui/search-input'
import { cn } from '../../../lib/utils'
import type { ContainsSearchStatus } from '../hooks/useContainsSearch'
import type { ContainsEntry } from '../utils/containsCatalog'
import { CONTAINS_MAX_PAGES, CONTAINS_PAGE_SIZE } from '../utils/containsSearch'
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
  totalCount: number
  isLoading: boolean
  searchText: string
  onSearchChange: (value: string) => void
  contains?: WorklistContainsState
  onContainsChange: (entry: ContainsEntry | undefined) => void
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

/** "Studies" title, study count, "Contains" filter and search field. */
export function WorklistHeader({
  totalCount,
  isLoading,
  searchText,
  onSearchChange,
  contains,
  onContainsChange,
  className,
}: WorklistHeaderProps): React.ReactElement {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
          Studies
        </h1>
        <div className="truncate text-12.5 text-ink-muted" aria-live="polite">
          {isLoading ? (
            'Loading studies…'
          ) : contains !== undefined ? (
            <ContainsSummary contains={contains} />
          ) : (
            `${totalCount} slide microscopy ${studies(totalCount)} on this server`
          )}
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex flex-none items-center gap-2">
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
          className="w-[340px]"
          inputClassName="placeholder:text-ink-faint"
        />
      </div>
    </div>
  )
}

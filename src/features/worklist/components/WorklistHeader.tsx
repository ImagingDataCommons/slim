import type * as React from 'react'

import { SearchInput } from '../../../components/ui/search-input'
import { SegmentedControl } from '../../../components/ui/segmented'
import { cn } from '../../../lib/utils'
import type { DateFilter } from '../utils/filters'

const DATE_FILTER_OPTIONS: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
]

export interface WorklistHeaderProps {
  totalCount: number
  isLoading: boolean
  searchText: string
  onSearchChange: (value: string) => void
  dateFilter: DateFilter
  onDateFilterChange: (filter: DateFilter) => void
  className?: string
}

/** "Studies" title, study count, search field and date filter. */
export function WorklistHeader({
  totalCount,
  isLoading,
  searchText,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  className,
}: WorklistHeaderProps): React.ReactElement {
  return (
    <div className={cn('flex items-end gap-4', className)}>
      <div>
        <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.015em] text-ink">
          Studies
        </h1>
        <div className="mt-1 text-ink-muted">
          {isLoading
            ? 'Loading studies…'
            : `${totalCount} slide microscopy ${totalCount === 1 ? 'study' : 'studies'} on this server`}
        </div>
      </div>
      <div className="flex-1" />
      <SearchInput
        aria-label="Search studies"
        placeholder="Search patient, ID, accession…"
        value={searchText}
        onValueChange={onSearchChange}
        iconSize={19}
        clearable
        className="w-[340px]"
        inputClassName="placeholder:text-ink-faint"
      />
      <SegmentedControl
        tone="worklist"
        aria-label="Study date"
        options={DATE_FILTER_OPTIONS}
        value={dateFilter}
        onChange={onDateFilterChange}
      />
    </div>
  )
}

import type * as React from 'react'

import { SearchInput } from '../../../components/ui/search-input'
import { cn } from '../../../lib/utils'

export interface WorklistHeaderProps {
  totalCount: number
  isLoading: boolean
  searchText: string
  onSearchChange: (value: string) => void
  className?: string
}

/** "Studies" title, study count and search field. */
export function WorklistHeader({
  totalCount,
  isLoading,
  searchText,
  onSearchChange,
  className,
}: WorklistHeaderProps): React.ReactElement {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
          Studies
        </h1>
        <div className="truncate text-12.5 text-ink-muted">
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
        clearable
        className="w-[340px]"
        inputClassName="placeholder:text-ink-faint"
      />
    </div>
  )
}

import type { PaginationState } from '@tanstack/react-table'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type DicomWebManager from '../../../DicomWebManager'
import { cn } from '../../../lib/utils'
import { buildStudyPath } from '../../../utils/routes'
import { getLocalStorage } from '../../../utils/safeStorage'
import { usePreferences } from '../../header/hooks/usePreferences'
import { useStudies } from '../hooks/useStudies'
import { loadStoredFilters, saveStoredFilters } from '../utils/filterStorage'
import {
  type DateFilter,
  filterStudiesByDateRange,
  filterStudiesBySearchText,
} from '../utils/filters'
import { WorklistHeader } from './WorklistHeader'
import { WorklistPagination } from './WorklistPagination'
import { WorklistTable } from './WorklistTable'

interface WorklistProps {
  clients: { [key: string]: DicomWebManager }
  className?: string
}

/** Studies worklist: title bar, search, date filter and paginated grid. */
export function Worklist({
  clients,
  className,
}: WorklistProps): React.ReactElement {
  const navigate = useNavigate()
  const { studies, isLoading, totalCount } = useStudies({ clients })
  const preferences = usePreferences()
  const [searchText, setSearchText] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    () =>
      loadStoredFilters(getLocalStorage(), preferences.rememberFilters)
        .dateFilter,
  )
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const filteredStudies = useMemo(
    () =>
      filterStudiesBySearchText(
        filterStudiesByDateRange(studies, dateFilter),
        searchText,
      ),
    [studies, dateFilter, searchText],
  )

  useEffect(() => {
    saveStoredFilters(
      getLocalStorage(),
      { dateFilter },
      preferences.rememberFilters,
    )
  }, [preferences.rememberFilters, dateFilter])

  const resetPage = useCallback((): void => {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }, [])

  const handleSearchChange = useCallback(
    (value: string): void => {
      setSearchText(value)
      resetPage()
    },
    [resetPage],
  )

  const handleDateFilterChange = useCallback(
    (value: DateFilter): void => {
      setDateFilter(value)
      resetPage()
    },
    [resetPage],
  )

  const handleRowClick = useCallback(
    (study: dmv.metadata.Study) => {
      navigate(buildStudyPath(study.StudyInstanceUID))
    },
    [navigate],
  )

  return (
    <main
      className={cn(
        'flex h-full min-h-0 flex-col gap-4 px-7 pb-5 pt-6',
        className,
      )}
    >
      <WorklistHeader
        totalCount={totalCount}
        isLoading={isLoading}
        searchText={searchText}
        onSearchChange={handleSearchChange}
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
      />
      <WorklistTable
        className="flex-1"
        data={filteredStudies}
        isLoading={isLoading}
        searchText={searchText}
        isCompact={preferences.compactRows}
        onRowClick={handleRowClick}
        pagination={pagination}
        onPaginationChange={setPagination}
        footer={
          <WorklistPagination
            pagination={pagination}
            totalCount={filteredStudies.length}
            onPaginationChange={setPagination}
          />
        }
      />
    </main>
  )
}

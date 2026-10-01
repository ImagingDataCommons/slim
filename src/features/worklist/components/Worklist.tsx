import type { PaginationState } from '@tanstack/react-table'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type * as React from 'react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import type DicomWebManager from '../../../DicomWebManager'
import { cn } from '../../../lib/utils'
import { buildStudyPath } from '../../../utils/routes'
import { usePreferences } from '../../preferences'
import { useStudies } from '../hooks/useStudies'
import {
  filterStudiesBySearchText,
  getEmptyStudiesMessage,
} from '../utils/filters'
import { clampPagination } from '../utils/pagination'
import { WorklistHeader } from './WorklistHeader'
import { WorklistPagination } from './WorklistPagination'
import { WorklistTable } from './WorklistTable'

export interface WorklistProps {
  clients: { [key: string]: DicomWebManager }
  className?: string
}

/** Studies worklist: title bar, search and paginated grid. */
export function Worklist({
  clients,
  className,
}: WorklistProps): React.ReactElement {
  const navigate = useNavigate()
  const { studies, isLoading } = useStudies({ clients })
  const preferences = usePreferences()
  const [searchText, setSearchText] = useState('')
  const deferredSearchText = useDeferredValue(searchText)
  const [requestedPagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const filteredStudies = useMemo(
    () => filterStudiesBySearchText(studies, deferredSearchText),
    [studies, deferredSearchText],
  )
  const pagination = clampPagination(
    requestedPagination,
    filteredStudies.length,
  )

  const handleSearchChange = useCallback((value: string): void => {
    setSearchText(value)
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }, [])

  const handleRowClick = useCallback(
    (study: dmv.metadata.Study) => {
      navigate(buildStudyPath(study.StudyInstanceUID))
    },
    [navigate],
  )

  return (
    <main
      className={cn(
        'flex h-full min-h-0 flex-col gap-3 px-5 pb-4 pt-4',
        className,
      )}
    >
      <WorklistHeader
        totalCount={studies.length}
        isLoading={isLoading}
        searchText={searchText}
        onSearchChange={handleSearchChange}
      />
      <WorklistTable
        className="flex-1"
        data={filteredStudies}
        isLoading={isLoading}
        emptyMessage={getEmptyStudiesMessage(deferredSearchText)}
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

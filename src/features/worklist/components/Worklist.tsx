import type { PaginationState } from '@tanstack/react-table'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type * as React from 'react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { Icon } from '../../../components/ui/icon'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import { cn } from '../../../lib/utils'
import { buildStudyPath } from '../../../utils/routes'
import { usePreferences } from '../../preferences'
import {
  type RowCheckState,
  useContainsRowChecks,
  useContainsSearch,
} from '../hooks/useContainsSearch'
import { useStudies } from '../hooks/useStudies'
import { useStudySearch } from '../hooks/useStudySearch'
import type { WorklistWidthTier } from '../hooks/useWorklistColumnLayout'
import {
  useWorklistCandidates,
  useWorklistRows,
} from '../hooks/useWorklistRows'
import {
  CONTAINS_PARAM,
  type ContainsEntry,
  findContainsEntry,
} from '../utils/containsCatalog'
import { getEmptyStudiesMessage } from '../utils/filters'
import { clampPagination } from '../utils/pagination'
import { WorklistHeader } from './WorklistHeader'
import { WorklistPagination } from './WorklistPagination'
import { WorklistTable } from './WorklistTable'

export interface WorklistProps {
  clients: { [key: string]: DicomWebManager }
  className?: string
}

function ContainsRowMarker({
  check,
  label,
}: {
  check: RowCheckState | undefined
  label: string
}): React.ReactElement | null {
  if (check?.status === 'checking') {
    /**
     * Not a live region: a page of candidates would announce up to one per
     * row at once. The text is still read when the row is reached.
     */
    return (
      <span
        title={`Checking for ${label}…`}
        className="size-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
      >
        <span className="sr-only">Checking for {label}…</span>
      </span>
    )
  }
  if (check?.status === 'unknown') {
    return (
      <span
        title={`Couldn't verify that this study has ${label}`}
        className="flex text-warning"
      >
        <Icon name="warning" size={16} />
        <span className="sr-only">
          Couldn't verify that this study has {label}
        </span>
      </span>
    )
  }
  return null
}

/** Studies worklist: title bar, filters and paginated grid. */
export function Worklist({
  clients,
  className,
}: WorklistProps): React.ReactElement {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { studies, isLoading } = useStudies({ clients })
  const preferences = usePreferences()
  const [searchText, setSearchText] = useState('')
  const deferredSearchText = useDeferredValue(searchText)
  const [requestedPagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [pageStudyUids, setPageStudyUids] = useState<readonly string[]>([])
  const [columnTier, setColumnTier] = useState<WorklistWidthTier>('base')
  const handleTierChange = useCallback((tier: WorklistWidthTier) => {
    setColumnTier(tier)
  }, [])

  const containsEntry = findContainsEntry(searchParams.get(CONTAINS_PARAM))
  /** Derived data may live on another store than the slides */
  const containsClient =
    containsEntry === undefined
      ? undefined
      : (clients[containsEntry.sopClassUid] ??
        clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE])
  const containsSearch = useContainsSearch(containsClient, containsEntry)
  const containsResult = containsSearch.result
  const serverSearch = useStudySearch({
    clients,
    searchText: containsEntry === undefined ? deferredSearchText : '',
  })

  const slideClient = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
  const serverUrl = slideClient?.baseURL
  const previousServerUrl = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (
      previousServerUrl.current !== undefined &&
      previousServerUrl.current !== serverUrl
    ) {
      setSearchText('')
      setPagination((previous) => ({ ...previous, pageIndex: 0 }))
      setSearchParams((previous) => {
        if (!previous.has(CONTAINS_PARAM)) return previous
        const next = new URLSearchParams(previous)
        next.delete(CONTAINS_PARAM)
        return next
      })
    }
    previousServerUrl.current = serverUrl
  }, [serverUrl, setSearchParams])

  const { loadedStudies, candidates } = useWorklistCandidates({
    studies,
    containsResult,
    pageStudyUids,
  })
  const getRowCheck = useContainsRowChecks(
    containsClient,
    slideClient,
    containsEntry,
    candidates,
  )
  const {
    containsStudies,
    hasUncheckedMatches,
    filteredStudies,
    tableStudies,
  } = useWorklistRows({
    studies,
    serverSearchMatches: serverSearch.matches,
    containsEntry,
    containsResult,
    loadedStudies,
    getRowCheck,
    deferredSearchText,
    pageStudyUids,
    slideClient,
  })

  const handleSearchChange = useCallback((value: string): void => {
    setSearchText(value)
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }, [])

  const handleContainsChange = (entry: ContainsEntry | undefined): void => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (entry === undefined) {
        next.delete(CONTAINS_PARAM)
      } else {
        next.set(CONTAINS_PARAM, entry.id)
      }
      return next
    })
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }

  const handleRowClick = useCallback(
    (study: dmv.metadata.Study) => {
      navigate(buildStudyPath(study.StudyInstanceUID))
    },
    [navigate],
  )

  const hasNoServer = serverUrl === ''
  /**
   * The first page, or a "Search more" page while nothing is listed yet:
   * the table shows it is searching rather than "No studies with …"
   */
  const isContainsSearchPending =
    containsSearch.status === 'searching' &&
    (containsSearch.result === undefined || containsStudies.length === 0)
  let emptyMessage = getEmptyStudiesMessage(deferredSearchText)
  if (hasNoServer) {
    /** Nothing was searched yet, whatever the filters say */
    emptyMessage = 'Select a server to search for studies.'
  } else if (containsEntry !== undefined && containsSearch.status === 'error') {
    /** A failed Contains search fails the list, whatever text is typed */
    emptyMessage = `Couldn't search for ${containsEntry.label}.`
  } else if (containsEntry !== undefined && deferredSearchText.trim() === '') {
    emptyMessage = `No studies with ${containsEntry.label}.`
  } else if (serverSearch.hasError) {
    emptyMessage = "Couldn't search for studies."
  }

  const pagination = clampPagination(
    requestedPagination,
    filteredStudies.length,
  )

  return (
    <main
      className={cn(
        'flex h-full min-h-0 min-w-0 w-full max-w-full flex-col gap-3 px-5 pb-4 pt-4 max-md:gap-2 max-md:px-3 max-md:pt-2',
        className,
      )}
    >
      <WorklistHeader
        isLoading={isLoading}
        searchText={searchText}
        onSearchChange={handleSearchChange}
        columnTier={columnTier}
        hiddenColumnIds={preferences.worklistHiddenColumnIds}
        contains={
          containsEntry === undefined ||
          containsSearch.status === 'idle' ||
          hasNoServer
            ? undefined
            : {
                entry: containsEntry,
                status: containsSearch.status,
                pages: containsSearch.pages,
                matchCount: containsStudies.length,
                isApproximate: hasUncheckedMatches,
                isPartial: containsResult?.isPartial ?? false,
                searchedCount: containsResult?.matches.size ?? 0,
                onRetry: containsSearch.retry,
                onLoadMore: containsSearch.loadMore,
                canLoadMore: containsSearch.canLoadMore,
                hasStoreFailures: containsResult?.hasStoreFailures ?? false,
              }
        }
        containsEntry={containsEntry}
        onContainsChange={handleContainsChange}
      />
      <WorklistTable
        className="flex-1"
        data={tableStudies}
        isLoading={
          isLoading ||
          (isContainsSearchPending && !hasNoServer) ||
          (serverSearch.isSearching && filteredStudies.length === 0)
        }
        emptyMessage={emptyMessage}
        isCompact={preferences.compactRows}
        hiddenColumnIds={preferences.worklistHiddenColumnIds}
        onTierChange={handleTierChange}
        onRowClick={handleRowClick}
        pagination={pagination}
        onPaginationChange={setPagination}
        onPageRowsChange={setPageStudyUids}
        renderRowMarker={
          candidates.length === 0 || containsEntry === undefined
            ? undefined
            : (study) => (
                <ContainsRowMarker
                  check={getRowCheck(study.StudyInstanceUID)}
                  label={containsEntry.label}
                />
              )
        }
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

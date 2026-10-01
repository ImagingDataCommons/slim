import type { PaginationState } from '@tanstack/react-table'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type * as React from 'react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { Icon } from '../../../components/ui/icon'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import { cn } from '../../../lib/utils'
import { buildStudyPath } from '../../../utils/routes'
import { usePreferences } from '../../preferences'
import {
  type ContainsCandidate,
  type RowCheckState,
  useContainsRowChecks,
  useContainsSearch,
} from '../hooks/useContainsSearch'
import { useStudies } from '../hooks/useStudies'
import {
  CONTAINS_PARAM,
  type ContainsEntry,
  findContainsEntry,
} from '../utils/containsCatalog'
import { withEntryModality } from '../utils/containsSearch'
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

const NO_CANDIDATES: readonly ContainsCandidate[] = []

function ContainsRowMarker({
  check,
  label,
}: {
  check: RowCheckState | undefined
  label: string
}): React.ReactElement | null {
  if (check?.status === 'checking') {
    return (
      <span
        role="status"
        title={`Checking for ${label}…`}
        className="size-2.5 animate-spin rounded-full border-[1.5px] border-line border-t-primary"
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
        <Icon name="warning" size={12} />
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

  const containsEntry = findContainsEntry(searchParams.get(CONTAINS_PARAM))
  /** Derived data may live on another store than the slides */
  const containsClient =
    containsEntry === undefined
      ? undefined
      : (clients[containsEntry.sopClassUids[0]] ??
        clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE])
  const containsSearch = useContainsSearch(containsClient, containsEntry)
  const containsResult = containsSearch.result

  const slideClient = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
  const loadedStudies = useMemo(
    () => new Map(studies.map((study) => [study.StudyInstanceUID, study])),
    [studies],
  )
  const needsCheck = (studyUid: string): boolean =>
    containsResult !== undefined &&
    (!containsResult.isExact || !loadedStudies.has(studyUid))

  const candidates = useMemo(() => {
    if (containsResult === undefined) return NO_CANDIDATES
    return pageStudyUids.flatMap((studyUid) => {
      const match = containsResult.matches.get(studyUid)
      const needsStudy = !loadedStudies.has(studyUid)
      const needsSopClass = !containsResult.isExact
      if (match === undefined || (!needsStudy && !needsSopClass)) return []
      return [
        { studyUid, seriesUids: match.seriesUids, needsStudy, needsSopClass },
      ]
    })
  }, [containsResult, pageStudyUids, loadedStudies])
  const getRowCheck = useContainsRowChecks(
    containsClient,
    slideClient,
    containsEntry,
    candidates,
  )

  let containsStudies = studies
  let hasUncheckedMatches = false
  if (containsEntry !== undefined) {
    containsStudies = []
    for (const [studyUid, match] of containsResult?.matches ?? []) {
      const check = getRowCheck(studyUid)
      if (check?.status === 'mismatch') continue
      if (check === undefined && needsCheck(studyUid)) {
        hasUncheckedMatches = true
      }
      const loaded = loadedStudies.get(studyUid)
      const fetched =
        check !== undefined && 'study' in check ? check.study : undefined
      containsStudies.push(
        loaded ?? withEntryModality(fetched ?? match.study, containsEntry),
      )
    }
  }
  const filteredStudies = useMemo(
    () => filterStudiesBySearchText(containsStudies, deferredSearchText),
    [containsStudies, deferredSearchText],
  )
  const pagination = clampPagination(
    requestedPagination,
    filteredStudies.length,
  )

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

  const isSearchingContains = containsSearch.status === 'searching'
  let emptyMessage = getEmptyStudiesMessage(deferredSearchText)
  if (containsEntry !== undefined && deferredSearchText.trim() === '') {
    emptyMessage =
      containsSearch.status === 'error'
        ? `Couldn't search for ${containsEntry.label}.`
        : `No studies with ${containsEntry.label}.`
  }

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
        contains={
          containsEntry === undefined || containsSearch.status === 'idle'
            ? undefined
            : {
                entry: containsEntry,
                status: containsSearch.status,
                pages: containsSearch.pages,
                matchCount: containsStudies.length,
                isApproximate: hasUncheckedMatches,
                isPartial: containsResult?.isPartial ?? false,
                onRetry: containsSearch.retry,
              }
        }
        onContainsChange={handleContainsChange}
      />
      <WorklistTable
        className="flex-1"
        data={filteredStudies}
        isLoading={isLoading || isSearchingContains}
        emptyMessage={emptyMessage}
        isCompact={preferences.compactRows}
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

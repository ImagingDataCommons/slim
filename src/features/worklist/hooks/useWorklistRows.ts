/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useMemo } from 'react'

import type { ContainsEntry } from '../utils/containsCatalog'
import type { ContainsSearchResult } from '../utils/containsSearch'
import {
  appendMissingStudies,
  filterStudiesBySearchText,
  mergeModalities,
  resolveContainsStudies,
  restrictContainsToServerSearch,
} from '../utils/filters'
import type { ContainsCandidate, RowCheckState } from './useContainsSearch'
import { useModalityBackfill } from './useModalityBackfill'

const NO_CANDIDATES: readonly ContainsCandidate[] = []

export interface UseWorklistCandidatesInput {
  studies: dmv.metadata.Study[]
  containsResult: ContainsSearchResult | undefined
  pageStudyUids: readonly string[]
}

export interface UseWorklistCandidatesResult {
  loadedStudies: ReadonlyMap<string, dmv.metadata.Study>
  candidates: readonly ContainsCandidate[]
}

/** Loaded-study map and per-page Contains row-check candidates. */
export function useWorklistCandidates({
  studies,
  containsResult,
  pageStudyUids,
}: UseWorklistCandidatesInput): UseWorklistCandidatesResult {
  const loadedStudies = useMemo(
    () => new Map(studies.map((study) => [study.StudyInstanceUID, study])),
    [studies],
  )

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

  return { loadedStudies, candidates }
}

export interface UseWorklistRowsInput {
  studies: dmv.metadata.Study[]
  serverSearchMatches: dmv.metadata.Study[]
  containsEntry: ContainsEntry | undefined
  containsResult: ContainsSearchResult | undefined
  loadedStudies: ReadonlyMap<string, dmv.metadata.Study>
  getRowCheck: (studyUid: string) => RowCheckState | undefined
  deferredSearchText: string
  pageStudyUids: readonly string[]
  slideClient: Parameters<typeof useModalityBackfill>[0]
}

export interface UseWorklistRowsResult {
  containsStudies: dmv.metadata.Study[]
  hasUncheckedMatches: boolean
  filteredStudies: dmv.metadata.Study[]
  tableStudies: dmv.metadata.Study[]
}

/**
 * Merges loaded studies, server search hits and Contains matches, then filters
 * and backfills modalities for the visible page. Memoizes the Contains list so
 * downstream filters keep a stable input when row checks are unchanged.
 */
export function useWorklistRows({
  studies,
  serverSearchMatches,
  containsEntry,
  containsResult,
  loadedStudies,
  getRowCheck,
  deferredSearchText,
  pageStudyUids,
  slideClient,
}: UseWorklistRowsInput): UseWorklistRowsResult {
  const containsResolution = useMemo(() => {
    if (containsEntry === undefined) {
      return {
        studies: appendMissingStudies(studies, serverSearchMatches),
        hasUncheckedMatches: false,
      }
    }
    const result = containsResult
    const resolved = resolveContainsStudies({
      entry: containsEntry,
      matches: result?.matches ?? new Map(),
      loadedStudies,
      getRowCheck,
      needsCheck: (studyUid) =>
        result !== undefined &&
        (!result.isExact || !loadedStudies.has(studyUid)),
    })
    return {
      studies: restrictContainsToServerSearch(
        resolved.studies,
        serverSearchMatches,
        deferredSearchText,
      ),
      hasUncheckedMatches: resolved.hasUncheckedMatches,
    }
  }, [
    containsEntry,
    containsResult,
    studies,
    serverSearchMatches,
    loadedStudies,
    getRowCheck,
    deferredSearchText,
  ])

  const containsStudies = containsResolution.studies
  const hasUncheckedMatches = containsResolution.hasUncheckedMatches

  const filteredStudies = useMemo(
    () => filterStudiesBySearchText(containsStudies, deferredSearchText),
    [containsStudies, deferredSearchText],
  )

  const pageStudies = useMemo(() => {
    const onPage = new Set(pageStudyUids)
    return filteredStudies.filter((study) => onPage.has(study.StudyInstanceUID))
  }, [filteredStudies, pageStudyUids])

  const backfilledModalities = useModalityBackfill(slideClient, pageStudies)
  const tableStudies = useMemo(
    () => mergeModalities(filteredStudies, backfilledModalities),
    [filteredStudies, backfilledModalities],
  )

  return {
    containsStudies,
    hasUncheckedMatches,
    filteredStudies,
    tableStudies,
  }
}

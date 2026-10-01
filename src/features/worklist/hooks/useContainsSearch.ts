/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useCallback, useEffect, useRef, useState } from 'react'

import { mapWithConcurrency } from '../../../utils/mapWithConcurrency'
import type { ContainsEntry } from '../utils/containsCatalog'
import {
  type ConfirmationStatus,
  type ContainsSearchClient,
  type ContainsSearchResult,
  confirmStudyContains,
  fetchSlideStudy,
  type SlideStudyClient,
  searchStudiesContaining,
} from '../utils/containsSearch'

const CHECK_CONCURRENCY = 6

/** Results per server and entry id, kept for the session */
const resultCache = new WeakMap<object, Map<string, ContainsSearchResult>>()
/** Row checks per server, keyed by `${entry id}|${study UID}` */
const rowCheckCache = new WeakMap<object, Map<string, RowCheck>>()

function cacheFor<T>(
  cache: WeakMap<object, Map<string, T>>,
  client: object,
): Map<string, T> {
  let entries = cache.get(client)
  if (entries === undefined) {
    entries = new Map()
    cache.set(client, entries)
  }
  return entries
}

const rowCheckKey = (entry: ContainsEntry, studyUid: string): string =>
  `${entry.id}|${studyUid}`

export type ContainsSearchStatus = 'idle' | 'searching' | 'done' | 'error'

export interface UseContainsSearchReturn {
  status: ContainsSearchStatus
  /** Pages received so far while searching */
  pages: number
  result?: ContainsSearchResult
  retry: () => void
}

interface SearchState {
  requestKey: string
  pages: number
  result?: ContainsSearchResult
  failed: boolean
}

/**
 * Lazily searches the server for studies holding the entry's SOP class. Runs
 * only while an entry is selected; results are cached for the session.
 */
export function useContainsSearch(
  client: ContainsSearchClient | undefined,
  entry: ContainsEntry | undefined,
): UseContainsSearchReturn {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<SearchState>({
    requestKey: '',
    pages: 0,
    failed: false,
  })
  const generation = useRef(0)
  const requestKey = entry === undefined ? '' : `${entry.id}:${attempt}`

  useEffect(() => {
    if (client === undefined || entry === undefined) return
    const cached = resultCache.get(client)?.get(entry.id)
    if (cached !== undefined) {
      setState({ requestKey, pages: 0, result: cached, failed: false })
      return
    }
    const current = ++generation.current
    const isCurrent = (): boolean => current === generation.current
    setState({ requestKey, pages: 0, failed: false })
    searchStudiesContaining(client, entry, {
      isCurrent,
      onPage: (pages) => {
        if (isCurrent()) setState({ requestKey, pages, failed: false })
      },
    })
      .then((result) => {
        if (!isCurrent()) return
        cacheFor(resultCache, client).set(entry.id, result)
        setState({ requestKey, pages: 0, result, failed: false })
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return
        console.error(error)
        setState({ requestKey, pages: 0, failed: true })
      })
    return () => {
      generation.current += 1
    }
  }, [client, entry, requestKey])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  if (entry === undefined || client === undefined) {
    return { status: 'idle', pages: 0, retry }
  }
  if (state.requestKey !== requestKey) {
    return { status: 'searching', pages: 0, retry }
  }
  if (state.failed) return { status: 'error', pages: 0, retry }
  if (state.result !== undefined) {
    return { status: 'done', pages: 0, result: state.result, retry }
  }
  return { status: 'searching', pages: state.pages, retry }
}

export interface ContainsCandidate {
  studyUid: string
  seriesUids: readonly string[]
  /** Not in the loaded worklist, so it may lack slides and display fields */
  needsStudy: boolean
  /** Matched on modality only */
  needsSopClass: boolean
}

export interface RowCheck {
  status: ConfirmationStatus
  /** Full worklist row, fetched when the study was not loaded */
  study?: dmv.metadata.Study
}

export type RowCheckState = RowCheck | { status: 'checking' }

async function checkCandidate(
  searchClient: ContainsSearchClient,
  studyClient: SlideStudyClient,
  entry: ContainsEntry,
  candidate: ContainsCandidate,
): Promise<RowCheck> {
  let study: dmv.metadata.Study | undefined
  let status: ConfirmationStatus = 'match'
  if (candidate.needsStudy) {
    try {
      const slideStudy = await fetchSlideStudy(studyClient, candidate.studyUid)
      if (slideStudy === null) return { status: 'mismatch' }
      study = slideStudy
    } catch {
      status = 'unknown'
    }
  }
  if (candidate.needsSopClass) {
    const confirmation = await confirmStudyContains(
      searchClient,
      entry,
      candidate.studyUid,
      candidate.seriesUids,
    )
    if (confirmation === 'mismatch') return { status: 'mismatch' }
    if (confirmation === 'unknown') status = 'unknown'
  }
  return { status, study }
}

/**
 * Checks the given candidate studies a few at a time: that they have slides,
 * and that they hold the entry's SOP class when it was matched on modality.
 * Answers are remembered; pass only the rows on screen to keep it lazy.
 */
export function useContainsRowChecks(
  searchClient: ContainsSearchClient | undefined,
  studyClient: SlideStudyClient | undefined,
  entry: ContainsEntry | undefined,
  candidates: readonly ContainsCandidate[],
): (studyUid: string) => RowCheckState | undefined {
  const [checks, setChecks] = useState<ReadonlyMap<string, RowCheck>>(() =>
    searchClient === undefined
      ? new Map()
      : new Map(cacheFor(rowCheckCache, searchClient)),
  )
  const inFlight = useRef(new Set<string>())

  useEffect(() => {
    if (
      searchClient === undefined ||
      studyClient === undefined ||
      entry === undefined
    ) {
      return
    }
    const cache = cacheFor(rowCheckCache, searchClient)
    const pending = candidates.filter((candidate) => {
      const key = rowCheckKey(entry, candidate.studyUid)
      return !cache.has(key) && !inFlight.current.has(key)
    })
    if (pending.length === 0) return
    for (const candidate of pending) {
      inFlight.current.add(rowCheckKey(entry, candidate.studyUid))
    }
    void mapWithConcurrency(pending, CHECK_CONCURRENCY, async (candidate) => {
      const key = rowCheckKey(entry, candidate.studyUid)
      const check = await checkCandidate(
        searchClient,
        studyClient,
        entry,
        candidate,
      )
      cache.set(key, check)
      inFlight.current.delete(key)
      setChecks((previous) => new Map(previous).set(key, check))
    })
  }, [searchClient, studyClient, entry, candidates])

  return (studyUid: string): RowCheckState | undefined => {
    if (entry === undefined) return undefined
    const check = checks.get(rowCheckKey(entry, studyUid))
    if (check !== undefined) return check
    return candidates.some((candidate) => candidate.studyUid === studyUid)
      ? { status: 'checking' }
      : undefined
  }
}

/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { mapWithConcurrency } from '../../../utils/mapWithConcurrency'
import type { ContainsEntry } from '../utils/containsCatalog'
import {
  CONTAINS_MAX_PAGES,
  type ConfirmationStatus,
  type ContainsSearchClient,
  type ContainsSearchResult,
  confirmStudyContains,
  fetchSlideStudy,
  mergeContainsMatches,
  type SlideStudyClient,
  searchStudiesContaining,
} from '../utils/containsSearch'

const CHECK_CONCURRENCY = 6

interface CachedContainsSearch {
  result: ContainsSearchResult
  nextOffset: number
  pages: number
}

/** Results per server and entry id, kept for the session */
const resultCache = new WeakMap<object, Map<string, CachedContainsSearch>>()
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
  /** QIDO pages received so far */
  pages: number
  result?: ContainsSearchResult
  retry: () => void
  /** Fetch the next QIDO page and append it */
  loadMore: () => void
  canLoadMore: boolean
}

interface SearchState {
  requestKey: string
  pages: number
  result?: ContainsSearchResult
  failed: boolean
  loadingMore: boolean
}

const EMPTY_SEARCH: SearchState = {
  requestKey: '',
  pages: 0,
  failed: false,
  loadingMore: false,
}

function storeCachedResult(
  client: object,
  entryId: string,
  result: ContainsSearchResult,
  pages: number,
  nextOffset: number,
): CachedContainsSearch {
  const cached: CachedContainsSearch = { result, pages, nextOffset }
  cacheFor(resultCache, client).set(entryId, cached)
  return cached
}

function canFetchMore(cached: CachedContainsSearch | undefined): boolean {
  if (cached === undefined) return false
  return cached.result.isPartial && cached.pages < CONTAINS_MAX_PAGES
}

/**
 * Lazily searches the server for one page of studies holding the entry's SOP
 * class. Further pages load only when the caller asks. Results are cached for
 * the session.
 */
export function useContainsSearch(
  client: ContainsSearchClient | undefined,
  entry: ContainsEntry | undefined,
): UseContainsSearchReturn {
  const [attempt, setAttempt] = useState(0)
  /**
   * "Search more" clicks belong to the request they were made for, so a
   * switch to another entry starts at zero in the same render
   */
  const [moreRequestsFor, setMoreRequestsFor] = useState({
    requestKey: '',
    count: 0,
  })
  const [state, setState] = useState<SearchState>(EMPTY_SEARCH)
  const generation = useRef(0)
  const requestKey = entry === undefined ? '' : `${entry.id}:${attempt}`
  const moreRequests =
    moreRequestsFor.requestKey === requestKey ? moreRequestsFor.count : 0

  useEffect(() => {
    if (client === undefined || entry === undefined) return
    const cached = resultCache.get(client)?.get(entry.id)
    const loadMore = moreRequests > 0 && canFetchMore(cached)
    if (cached !== undefined && !loadMore) {
      setState({
        requestKey,
        pages: cached.pages,
        result: cached.result,
        failed: false,
        loadingMore: false,
      })
      return
    }
    const current = ++generation.current
    const isCurrent = (): boolean => current === generation.current
    if (loadMore && cached !== undefined) {
      setState({
        requestKey,
        pages: cached.pages,
        result: cached.result,
        failed: false,
        loadingMore: true,
      })
      searchStudiesContaining(client, entry, {
        isCurrent,
        offset: cached.nextOffset,
      })
        .then((page) => {
          if (!isCurrent()) return
          const pages = cached.pages + 1
          const merged: ContainsSearchResult = {
            matches: mergeContainsMatches(cached.result.matches, page.matches),
            isExact: cached.result.isExact && page.isExact,
            isPartial: page.isPartial,
            pageRowCount: page.pageRowCount,
          }
          storeCachedResult(
            client,
            entry.id,
            merged,
            pages,
            cached.nextOffset + page.pageRowCount,
          )
          setState({
            requestKey,
            pages,
            result: merged,
            failed: false,
            loadingMore: false,
          })
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return
          console.error(error)
          setState({
            requestKey,
            pages: cached.pages,
            result: cached.result,
            failed: false,
            loadingMore: false,
          })
        })
    } else {
      setState({ requestKey, pages: 0, failed: false, loadingMore: false })
      searchStudiesContaining(client, entry, { isCurrent })
        .then((result) => {
          if (!isCurrent()) return
          storeCachedResult(client, entry.id, result, 1, result.pageRowCount)
          setState({
            requestKey,
            pages: 1,
            result,
            failed: false,
            loadingMore: false,
          })
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return
          console.error(error)
          setState({ requestKey, pages: 0, failed: true, loadingMore: false })
        })
    }
    return () => {
      generation.current += 1
    }
  }, [client, entry, requestKey, moreRequests])

  const retry = useCallback(() => {
    if (client !== undefined && entry !== undefined) {
      resultCache.get(client)?.delete(entry.id)
    }
    setAttempt((value) => value + 1)
  }, [client, entry])

  const loadMore = useCallback(() => {
    if (client === undefined || entry === undefined) return
    if (!canFetchMore(resultCache.get(client)?.get(entry.id))) return
    setMoreRequestsFor((current) => ({
      requestKey,
      count: current.requestKey === requestKey ? current.count + 1 : 1,
    }))
  }, [client, entry, requestKey])

  if (entry === undefined || client === undefined) {
    return {
      status: 'idle',
      pages: 0,
      retry,
      loadMore,
      canLoadMore: false,
    }
  }
  if (state.requestKey !== requestKey) {
    return {
      status: 'searching',
      pages: 0,
      retry,
      loadMore,
      canLoadMore: false,
    }
  }
  if (state.failed) {
    return { status: 'error', pages: 0, retry, loadMore, canLoadMore: false }
  }
  if (state.result !== undefined && !state.loadingMore) {
    return {
      status: 'done',
      pages: state.pages,
      result: state.result,
      retry,
      loadMore,
      canLoadMore: state.result.isPartial && state.pages < CONTAINS_MAX_PAGES,
    }
  }
  return {
    status: 'searching',
    pages: state.pages,
    result: state.result,
    retry,
    loadMore,
    canLoadMore: false,
  }
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

function seedChecks(
  searchClient: ContainsSearchClient | undefined,
): ReadonlyMap<string, RowCheck> {
  return searchClient === undefined
    ? new Map()
    : new Map(cacheFor(rowCheckCache, searchClient))
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
  /**
   * Answers are kept per search client: on a server switch the state is
   * re-seeded from the new client's cache, so another server's verdicts are
   * never shown and its studies are checked again.
   */
  const [checkState, setCheckState] = useState(() => ({
    client: searchClient,
    checks: seedChecks(searchClient),
  }))
  let checks = checkState.checks
  if (checkState.client !== searchClient) {
    checks = seedChecks(searchClient)
    setCheckState({ client: searchClient, checks })
  }
  const inFlight = useRef(new WeakMap<object, Set<string>>())

  useEffect(() => {
    if (
      searchClient === undefined ||
      studyClient === undefined ||
      entry === undefined
    ) {
      return
    }
    const cache = cacheFor(rowCheckCache, searchClient)
    let running = inFlight.current.get(searchClient)
    if (running === undefined) {
      running = new Set()
      inFlight.current.set(searchClient, running)
    }
    const clientInFlight = running
    const pending = candidates.filter((candidate) => {
      const key = rowCheckKey(entry, candidate.studyUid)
      return !cache.has(key) && !clientInFlight.has(key)
    })
    if (pending.length === 0) return
    for (const candidate of pending) {
      clientInFlight.add(rowCheckKey(entry, candidate.studyUid))
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
      clientInFlight.delete(key)
      setCheckState((previous) =>
        previous.client === searchClient
          ? {
              client: searchClient,
              checks: new Map(previous.checks).set(key, check),
            }
          : previous,
      )
    })
  }, [searchClient, studyClient, entry, candidates])

  /** Avoid scanning the candidate list on every row lookup during render */
  const candidateUids = useMemo(
    () => new Set(candidates.map((candidate) => candidate.studyUid)),
    [candidates],
  )

  return useCallback(
    (studyUid: string): RowCheckState | undefined => {
      if (entry === undefined) return undefined
      const check = checks.get(rowCheckKey(entry, studyUid))
      if (check !== undefined) return check
      return candidateUids.has(studyUid) ? { status: 'checking' } : undefined
    },
    [entry, checks, candidateUids],
  )
}

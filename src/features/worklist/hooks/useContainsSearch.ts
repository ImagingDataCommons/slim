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
  type StoreCursor,
  searchStoresContaining,
  storeClients,
} from '../utils/containsSearch'

const CHECK_CONCURRENCY = 6

interface CachedContainsSearch {
  result: ContainsSearchResult
  /** Where the next page of each store starts */
  cursors: StoreCursor[]
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

/** An "unknown" verdict (a check that failed) is asked again after this */
export const UNKNOWN_ROW_CHECK_TTL_MS = 30_000
/** When each "unknown" verdict was reached */
const unknownCheckedAt = new WeakMap<RowCheck, number>()

/** Whether a remembered verdict can be shown without checking again */
function isSettledCheck(check: RowCheck | undefined, now: number): boolean {
  if (check === undefined) return false
  if (check.status !== 'unknown') return true
  return now - (unknownCheckedAt.get(check) ?? 0) < UNKNOWN_ROW_CHECK_TTL_MS
}

function isCachedRowCheck(client: object, key: string): boolean {
  return rowCheckCache.get(client)?.has(key) ?? false
}

/** Drop the entry's "unknown" verdicts so a retry checks those rows again */
function forgetUnknownRowChecks(client: object, entry: ContainsEntry): void {
  const checks = rowCheckCache.get(client)
  if (checks === undefined) return
  for (const [key, check] of checks) {
    if (check.status === 'unknown' && key.startsWith(`${entry.id}|`)) {
      checks.delete(key)
    }
  }
}

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
  /** Server the result came from; another server's result is never shown */
  client?: ContainsSearchClient
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
  cursors: StoreCursor[],
): CachedContainsSearch {
  const cached: CachedContainsSearch = { result, pages, cursors }
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
   * Pending "Search more" clicks, for the server and request they were made
   * for, so a switch to another entry or server starts at zero in the same
   * render. Each loaded page consumes one click, so coming back to an entry
   * does not fetch again.
   */
  const [moreRequestsFor, setMoreRequestsFor] = useState<{
    client?: ContainsSearchClient
    requestKey: string
    count: number
  }>({ requestKey: '', count: 0 })
  const [state, setState] = useState<SearchState>(EMPTY_SEARCH)
  const generation = useRef(0)
  const requestKey = entry === undefined ? '' : `${entry.id}:${attempt}`
  const moreRequests =
    moreRequestsFor.client === client &&
    moreRequestsFor.requestKey === requestKey
      ? moreRequestsFor.count
      : 0

  useEffect(() => {
    if (client === undefined || entry === undefined) return
    const commit = (next: Omit<SearchState, 'client'>): void => {
      setState({ ...next, client })
    }
    const cached = resultCache.get(client)?.get(entry.id)
    const loadMore = moreRequests > 0 && canFetchMore(cached)
    if (cached !== undefined && !loadMore) {
      commit({
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
    const consumeMoreRequest = (): void => {
      setMoreRequestsFor((pending) =>
        pending.client === client &&
        pending.requestKey === requestKey &&
        pending.count > 0
          ? { ...pending, count: pending.count - 1 }
          : pending,
      )
    }
    if (loadMore && cached !== undefined) {
      commit({
        requestKey,
        pages: cached.pages,
        result: cached.result,
        failed: false,
        loadingMore: true,
      })
      searchStoresContaining(storeClients(client), entry, {
        isCurrent,
        cursors: cached.cursors,
      })
        .then(({ result: page, cursors }) => {
          if (!isCurrent()) return
          const pages = cached.pages + 1
          const merged: ContainsSearchResult = {
            matches: mergeContainsMatches(cached.result.matches, page.matches),
            isExact: cached.result.isExact && page.isExact,
            isPartial: page.isPartial,
            pageRowCount: page.pageRowCount,
            hasStoreFailures: page.hasStoreFailures,
          }
          storeCachedResult(client, entry.id, merged, pages, cursors)
          commit({
            requestKey,
            pages,
            result: merged,
            failed: false,
            loadingMore: false,
          })
          consumeMoreRequest()
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return
          console.error(error)
          /**
           * A failed attempt counts as a page, so a store that keeps failing
           * stops being offered at the cap, and the header says why
           */
          const pages = cached.pages + 1
          const result: ContainsSearchResult = {
            ...cached.result,
            hasStoreFailures: true,
          }
          storeCachedResult(client, entry.id, result, pages, cached.cursors)
          commit({
            requestKey,
            pages,
            result,
            failed: false,
            loadingMore: false,
          })
          consumeMoreRequest()
        })
    } else {
      commit({ requestKey, pages: 0, failed: false, loadingMore: false })
      searchStoresContaining(storeClients(client), entry, { isCurrent })
        .then(({ result, cursors }) => {
          if (!isCurrent()) return
          storeCachedResult(client, entry.id, result, 1, cursors)
          commit({
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
          commit({ requestKey, pages: 0, failed: true, loadingMore: false })
        })
    }
    return () => {
      generation.current += 1
    }
  }, [client, entry, requestKey, moreRequests])

  const retry = useCallback(() => {
    if (client !== undefined && entry !== undefined) {
      resultCache.get(client)?.delete(entry.id)
      forgetUnknownRowChecks(client, entry)
    }
    setAttempt((value) => value + 1)
  }, [client, entry])

  const loadMore = useCallback(() => {
    if (client === undefined || entry === undefined) return
    if (!canFetchMore(resultCache.get(client)?.get(entry.id))) return
    setMoreRequestsFor((current) => ({
      client,
      requestKey,
      count:
        current.client === client && current.requestKey === requestKey
          ? current.count + 1
          : 1,
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
  if (state.requestKey !== requestKey || state.client !== client) {
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
    const now = Date.now()
    const pending = candidates.filter((candidate) => {
      const key = rowCheckKey(entry, candidate.studyUid)
      return !isSettledCheck(cache.get(key), now) && !clientInFlight.has(key)
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
      if (check.status === 'unknown') unknownCheckedAt.set(check, Date.now())
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
      const key = rowCheckKey(entry, studyUid)
      const check = checks.get(key)
      /** Retry dropped this "unknown" verdict; it is being checked again */
      const isRetried =
        check?.status === 'unknown' &&
        searchClient !== undefined &&
        !isCachedRowCheck(searchClient, key)
      if (check !== undefined && !isRetried) return check
      return candidateUids.has(studyUid) ? { status: 'checking' } : undefined
    },
    [entry, checks, candidateUids, searchClient],
  )
}

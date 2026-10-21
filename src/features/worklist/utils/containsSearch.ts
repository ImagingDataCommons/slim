/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import type { ContainsEntry } from './containsCatalog'
import { normalizeModalities } from './studyFields'
import { buildStudyQueryParams } from './studyQuery'

/** One QIDO page. Small enough for IDC SEG/OT dumps, covers five worklist pages. */
export const CONTAINS_PAGE_SIZE = 100
/** Cap on "Search more" so a modality fallback cannot walk the whole store. */
export const CONTAINS_MAX_PAGES = 10

const STUDY_UID_TAG = '0020000D'
const SERIES_UID_TAG = '0020000E'
const SOP_CLASS_UID_TAG = '00080016'

/** Study attributes the worklist shows, requested along with each match */
export const STUDY_FIELDS = [
  'PatientName',
  'PatientID',
  'PatientBirthDate',
  'PatientSex',
  'StudyDate',
  'StudyTime',
  'AccessionNumber',
  'StudyID',
  'ReferringPhysicianName',
].join(',')

export interface ContainsSearchClient {
  searchForSeries: (
    options: dwc.api.SearchForSeriesOptions,
  ) => Promise<dwc.api.Series[]>
  searchForInstances: (
    options: dwc.api.SearchForInstancesOptions,
  ) => Promise<dwc.api.Instance[]>
}

export interface SlideStudyClient {
  searchForStudies: (
    options: dwc.api.SearchForStudiesOptions,
  ) => Promise<dwc.api.Study[]>
}

export interface ContainsMatch {
  seriesUids: readonly string[]
  /**
   * Study attributes copied from the first matching series or instance. They
   * lack ModalitiesInStudy and the series count.
   */
  study: dmv.metadata.Study
}

export interface ContainsSearchResult {
  /** Matches per Study Instance UID, in server order */
  matches: ReadonlyMap<string, ContainsMatch>
  /** Matched on SOP class; otherwise only on modality and needs checking */
  isExact: boolean
  /** This page was full, so later matches may exist */
  isPartial: boolean
  /** QIDO rows in this page; add to the offset to fetch the next page */
  pageRowCount: number
}

export interface ContainsSearchOptions {
  /** Called with the number of pages received so far */
  onPage?: (pages: number) => void
  /** Stop paging once the caller no longer wants the result */
  isCurrent?: () => boolean
  /** QIDO offset of this page; default 0 */
  offset?: number
}

type SearchStrategy = 'sopClass' | 'modality'

/** Servers that rejected SOPClassUID matching, so they are not asked again */
const strategyByClient = new WeakMap<object, SearchStrategy>()

function firstValue(item: unknown, tag: string): string | undefined {
  if (item === null || typeof item !== 'object') return undefined
  const element = (item as Record<string, unknown>)[tag]
  if (element === null || typeof element !== 'object') return undefined
  const value = (element as { Value?: unknown }).Value
  if (!Array.isArray(value) || value[0] == null) return undefined
  return String(value[0])
}

function isBadRequest(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 400
}

const formatStudy = (row: unknown): dmv.metadata.Study =>
  /** DMV types formatted metadata as the generic Dataset */
  dmv.metadata.formatMetadata(row as dmv.metadata.Dataset)
    .dataset as dmv.metadata.Study

class IgnoredMatchingKeyError extends Error {}

/**
 * One QIDO page. A full page means more matches may exist; the hook fetches
 * the next offset only when the user asks.
 */
async function fetchOnePage(
  fetchPage: (offset: number) => Promise<unknown[]>,
  offset: number,
  { onPage, isCurrent = () => true }: ContainsSearchOptions,
): Promise<{ rows: unknown[]; isPartial: boolean }> {
  if (!isCurrent()) {
    return { rows: [], isPartial: false }
  }
  const items = await fetchPage(offset)
  onPage?.(1)
  return {
    rows: items,
    isPartial: items.length >= CONTAINS_PAGE_SIZE,
  }
}

function groupByStudy(rows: unknown[]): Map<string, ContainsMatch> {
  const matches = new Map<string, { seriesUids: string[]; row: unknown }>()
  for (const row of rows) {
    const studyUid = firstValue(row, STUDY_UID_TAG)
    const seriesUid = firstValue(row, SERIES_UID_TAG)
    if (studyUid === undefined || seriesUid === undefined) continue
    const match = matches.get(studyUid)
    if (match === undefined) {
      matches.set(studyUid, { seriesUids: [seriesUid], row })
    } else if (!match.seriesUids.includes(seriesUid)) {
      match.seriesUids.push(seriesUid)
    }
  }
  return new Map(
    [...matches].map(([studyUid, { seriesUids, row }]) => [
      studyUid,
      { seriesUids, study: formatStudy(row) },
    ]),
  )
}

async function searchBySopClass(
  client: ContainsSearchClient,
  entry: ContainsEntry,
  options: ContainsSearchOptions,
): Promise<ContainsSearchResult> {
  const offset = options.offset ?? 0
  const { sopClassUid } = entry
  const { rows, isPartial } = await fetchOnePage(
    async (pageOffset) => {
      const items = await client.searchForInstances({
        queryParams: {
          SOPClassUID: sopClassUid,
          includefield: STUDY_FIELDS,
          limit: CONTAINS_PAGE_SIZE,
          offset: pageOffset,
        },
      })
      /** A server that ignores the key returns every instance instead */
      const ignoresKey = items.some((item) => {
        const value = firstValue(item, SOP_CLASS_UID_TAG)
        return value !== undefined && value !== sopClassUid
      })
      if (ignoresKey) throw new IgnoredMatchingKeyError()
      return items
    },
    offset,
    options,
  )
  return {
    matches: groupByStudy(rows),
    isExact: true,
    isPartial,
    pageRowCount: rows.length,
  }
}

async function searchByModality(
  client: ContainsSearchClient,
  entry: ContainsEntry,
  options: ContainsSearchOptions,
): Promise<ContainsSearchResult> {
  const offset = options.offset ?? 0
  const { rows, isPartial } = await fetchOnePage(
    async (pageOffset) =>
      await client.searchForSeries({
        queryParams: {
          Modality: entry.modality,
          includefield: STUDY_FIELDS,
          limit: CONTAINS_PAGE_SIZE,
          offset: pageOffset,
        },
      }),
    offset,
    options,
  )
  return {
    matches: groupByStudy(rows),
    isExact: !entry.needsConfirmation,
    isPartial,
    pageRowCount: rows.length,
  }
}

/**
 * Merge extra Contains matches into a base map, keeping the first study row
 * and appending series UIDs that were not already listed.
 */
export function mergeContainsMatches(
  base: ReadonlyMap<string, ContainsMatch>,
  extra: ReadonlyMap<string, ContainsMatch>,
): Map<string, ContainsMatch> {
  const merged = new Map(base)
  for (const [studyUid, match] of extra) {
    const current = merged.get(studyUid)
    if (current === undefined) {
      merged.set(studyUid, match)
      continue
    }
    const seriesUids = [...current.seriesUids]
    for (const seriesUid of match.seriesUids) {
      if (!seriesUids.includes(seriesUid)) seriesUids.push(seriesUid)
    }
    merged.set(studyUid, { seriesUids, study: current.study })
  }
  return merged
}

/**
 * One page of studies holding series of the entry's SOP class. Matches on
 * SOPClassUID at the instance level, and falls back to the series modality on
 * servers that reject or ignore that key (Google Cloud Healthcare rejects it).
 * Not limited to slide microscopy studies; see `fetchSlideStudy`.
 */
export async function searchStudiesContaining(
  client: ContainsSearchClient,
  entry: ContainsEntry,
  options: ContainsSearchOptions = {},
): Promise<ContainsSearchResult> {
  if (strategyByClient.get(client) !== 'modality') {
    try {
      const result = await searchBySopClass(client, entry, options)
      if (options.isCurrent?.() ?? true) {
        strategyByClient.set(client, 'sopClass')
      }
      return result
    } catch (error: unknown) {
      if (!isBadRequest(error) && !(error instanceof IgnoredMatchingKeyError)) {
        throw error
      }
      strategyByClient.set(client, 'modality')
      options.onPage?.(0)
    }
  }
  return await searchByModality(client, entry, options)
}

/** Where the next page of one store starts */
export interface StoreCursor {
  offset: number
  /** The store's last page was not full, so it has no more matches */
  isDone: boolean
}

export interface ContainsStoresPage {
  result: ContainsSearchResult
  /** One per store, in the order of `storeClients` */
  cursors: StoreCursor[]
}

/** A client that can be split into one search client per store */
interface MultiStoreClient {
  storeSearchClients: () => ContainsSearchClient[]
}

function isMultiStoreClient(client: object): client is MultiStoreClient {
  return (
    typeof (client as Partial<MultiStoreClient>).storeSearchClients ===
    'function'
  )
}

/**
 * The per-store clients of a client that combines several stores, or the
 * client itself when there is only one store to page
 */
export function storeClients(
  client: ContainsSearchClient,
): ContainsSearchClient[] {
  if (!isMultiStoreClient(client)) return [client]
  const clients = client.storeSearchClients()
  return clients.length > 1 ? clients : [client]
}

/**
 * The next page of every store that may have more matches. Each store keeps
 * its own offset and SOP class or modality strategy, so a store that
 * rejects SOPClassUID falls back on its own. A failing store is skipped and
 * retried with the next page; the search only fails when every store does.
 */
export async function searchStoresContaining(
  clients: readonly ContainsSearchClient[],
  entry: ContainsEntry,
  {
    cursors,
    ...options
  }: Omit<ContainsSearchOptions, 'offset'> & {
    cursors?: readonly StoreCursor[]
  } = {},
): Promise<ContainsStoresPage> {
  const outcomes = await Promise.all(
    clients.map(async (client, index) => {
      const cursor = cursors?.[index] ?? { offset: 0, isDone: false }
      if (cursor.isDone) return { cursor }
      try {
        const result = await searchStudiesContaining(client, entry, {
          ...options,
          offset: cursor.offset,
        })
        return { cursor, result }
      } catch (error: unknown) {
        return { cursor, error }
      }
    }),
  )
  const searched = outcomes.filter((outcome) => !outcome.cursor.isDone)
  const failures = searched.filter((outcome) => 'error' in outcome)
  if (searched.length > 0 && failures.length === searched.length) {
    throw failures[failures.length - 1].error
  }
  let matches: ReadonlyMap<string, ContainsMatch> = new Map()
  let isExact = true
  let isPartial = false
  let pageRowCount = 0
  const nextCursors = outcomes.map(({ cursor, result }) => {
    if (result === undefined) return cursor
    matches = mergeContainsMatches(matches, result.matches)
    isExact &&= result.isExact
    isPartial ||= result.isPartial
    pageRowCount += result.pageRowCount
    return {
      offset: cursor.offset + result.pageRowCount,
      isDone: !result.isPartial,
    }
  })
  return {
    result: { matches, isExact, isPartial, pageRowCount },
    cursors: nextCursors,
  }
}

/**
 * The worklist row of a study, or null when it has no slide microscopy
 * series (e.g. a radiology study with the same kind of derived data).
 */
export async function fetchSlideStudy(
  client: SlideStudyClient,
  studyInstanceUID: string,
): Promise<dmv.metadata.Study | null> {
  const [row] = await client.searchForStudies({
    queryParams: {
      ...buildStudyQueryParams(),
      StudyInstanceUID: studyInstanceUID,
    },
  })
  if (row === undefined) return null
  const study = formatStudy(row)
  /** Google Cloud omits ModalitiesInStudy even when matching on it */
  return normalizeModalities(study.ModalitiesInStudy).length === 0
    ? { ...study, ModalitiesInStudy: ['SM'] }
    : study
}

/**
 * The study row with the entry's modality listed, for rows built from
 * matches rather than loaded with the worklist.
 */
export function withEntryModality(
  study: dmv.metadata.Study,
  entry: ContainsEntry,
): dmv.metadata.Study {
  const modalities = normalizeModalities(study.ModalitiesInStudy)
  if (modalities.includes(entry.modality)) return study
  return {
    ...study,
    ModalitiesInStudy: [...modalities, entry.modality].sort((a, b) =>
      a.localeCompare(b),
    ),
  }
}

export type ConfirmationStatus = 'match' | 'mismatch' | 'unknown'

/**
 * Whether one of the study's candidate series holds the entry's SOP class,
 * judged from the first instance of each series. 'unknown' when a lookup
 * failed before any match was found.
 */
export async function confirmStudyContains(
  client: ContainsSearchClient,
  entry: ContainsEntry,
  studyInstanceUID: string,
  seriesInstanceUIDs: readonly string[],
): Promise<ConfirmationStatus> {
  let hasFailure = false
  for (const seriesInstanceUID of seriesInstanceUIDs) {
    try {
      const [instance] = await client.searchForInstances({
        studyInstanceUID,
        seriesInstanceUID,
        queryParams: { limit: 1, includefield: SOP_CLASS_UID_TAG },
      })
      const sopClassUid = firstValue(instance, SOP_CLASS_UID_TAG)
      if (sopClassUid === entry.sopClassUid) return 'match'
    } catch {
      hasFailure = true
    }
  }
  return hasFailure ? 'unknown' : 'mismatch'
}

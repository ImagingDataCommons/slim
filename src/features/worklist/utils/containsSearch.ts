/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import type { ContainsEntry } from './containsCatalog'
import { normalizeModalities } from './studyFields'
import { buildStudyQueryParams } from './studyQuery'

export const CONTAINS_PAGE_SIZE = 5000
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
  /** Stopped at the page cap, so later matches are missing */
  isPartial: boolean
}

export interface ContainsSearchOptions {
  /** Called with the number of pages received so far */
  onPage?: (pages: number) => void
  /** Stop paging once the caller no longer wants the result */
  isCurrent?: () => boolean
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

async function collectPages(
  fetchPage: (offset: number) => Promise<unknown[]>,
  { onPage, isCurrent = () => true }: ContainsSearchOptions,
): Promise<{ rows: unknown[]; isPartial: boolean }> {
  const rows: unknown[] = []
  for (let page = 0; page < CONTAINS_MAX_PAGES; page++) {
    const items = await fetchPage(rows.length)
    rows.push(...items)
    onPage?.(page + 1)
    if (items.length < CONTAINS_PAGE_SIZE || !isCurrent()) {
      return { rows, isPartial: false }
    }
  }
  return { rows, isPartial: true }
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
  const rows: unknown[] = []
  let isPartial = false
  for (const sopClassUid of entry.sopClassUids) {
    const result = await collectPages(async (offset) => {
      const items = await client.searchForInstances({
        queryParams: {
          SOPClassUID: sopClassUid,
          includefield: STUDY_FIELDS,
          limit: CONTAINS_PAGE_SIZE,
          offset,
        },
      })
      /** A server that ignores the key returns every instance instead */
      const ignoresKey = items.some((item) => {
        const value = firstValue(item, SOP_CLASS_UID_TAG)
        return value !== undefined && value !== sopClassUid
      })
      if (ignoresKey) throw new IgnoredMatchingKeyError()
      return items
    }, options)
    rows.push(...result.rows)
    isPartial ||= result.isPartial
  }
  return { matches: groupByStudy(rows), isExact: true, isPartial }
}

async function searchByModality(
  client: ContainsSearchClient,
  entry: ContainsEntry,
  options: ContainsSearchOptions,
): Promise<ContainsSearchResult> {
  const { rows, isPartial } = await collectPages(
    async (offset) =>
      await client.searchForSeries({
        queryParams: {
          Modality: entry.modality,
          includefield: STUDY_FIELDS,
          limit: CONTAINS_PAGE_SIZE,
          offset,
        },
      }),
    options,
  )
  return {
    matches: groupByStudy(rows),
    isExact: !entry.needsConfirmation,
    isPartial,
  }
}

/**
 * Studies on the server holding series of the entry's SOP class. Matches on
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
      strategyByClient.set(client, 'sopClass')
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
      if (
        sopClassUid !== undefined &&
        entry.sopClassUids.includes(sopClassUid)
      ) {
        return 'match'
      }
    } catch {
      hasFailure = true
    }
  }
  return hasFailure ? 'unknown' : 'mismatch'
}

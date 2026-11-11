/**
 * Pure functions for filtering and searching study data.
 * No side effects - suitable for unit testing.
 */

/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { formatRawPersonName } from '../../../utils/dicom/personName'
import { formatPersonName } from '../../../utils/displayFormat'
import type { ContainsEntry } from './containsCatalog'
import { type ContainsMatch, withEntryModality } from './containsSearch'
import { normalizeModalities } from './studyFields'

/** Row check status used when merging Contains matches into the study list. */
export type ContainsRowCheckLookup = (studyUid: string) =>
  | {
      status: 'mismatch' | 'match' | 'unknown' | 'checking'
      study?: dmv.metadata.Study
    }
  | undefined

/** Empty-state text of the worklist table, quoting the search query. */
export function getEmptyStudiesMessage(searchText = ''): string {
  const query = searchText.trim()
  return query === '' ? 'No studies found.' : `No studies match “${query}”.`
}

/**
 * Text test for a search term. A term with `*` or `?` uses DICOM wildcard
 * matching on the whole value, as the server search does; any other term
 * matches anywhere in the value.
 */
function toSearchMatcher(search: string): (text: string) => boolean {
  if (!/[*?]/.test(search)) {
    return (text) => text.toLowerCase().includes(search)
  }
  const source = Array.from(search, (char) => {
    if (char === '*') return '.*'
    if (char === '?') return '.'
    return char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }).join('')
  const pattern = new RegExp(`^${source}$`, 'i')
  return (text) => pattern.test(text)
}

/**
 * Filters studies by search text across identifiers and the patient name,
 * matching both the displayed ("Doe, Jane") and raw ("Doe Jane") forms.
 */
export function filterStudiesBySearchText(
  studies: dmv.metadata.Study[],
  searchText: string,
): dmv.metadata.Study[] {
  const search = searchText.toLowerCase().trim()
  if (search === '') {
    return studies
  }
  const matches = toSearchMatcher(search)

  return studies.filter((study) => {
    const fields: unknown[] = [
      study.AccessionNumber,
      study.StudyID,
      study.PatientID,
      formatPersonName(study.PatientName),
      formatRawPersonName(study.PatientName),
    ]

    return fields.some(
      (field) =>
        field !== undefined && field !== null && matches(String(field)),
    )
  })
}

/** `studies` followed by the `extra` studies it does not already list. */
export function appendMissingStudies(
  studies: dmv.metadata.Study[],
  extra: dmv.metadata.Study[],
): dmv.metadata.Study[] {
  if (extra.length === 0) return studies
  const listed = new Set(studies.map((study) => study.StudyInstanceUID))
  const missing = extra.filter((study) => !listed.has(study.StudyInstanceUID))
  return missing.length === 0 ? studies : [...studies, ...missing]
}

/**
 * True when QIDO did not return usable ModalitiesInStudy.
 */
export function modalitiesNeedBackfill(study: dmv.metadata.Study): boolean {
  return normalizeModalities(study.ModalitiesInStudy).length === 0
}

/** Studies with ModalitiesInStudy filled in from `modalitiesByUid` where missing. */
export function mergeModalities(
  studies: dmv.metadata.Study[],
  modalitiesByUid: ReadonlyMap<string, string[]>,
): dmv.metadata.Study[] {
  if (modalitiesByUid.size === 0) return studies
  return studies.map((study) => {
    const modalities = modalitiesByUid.get(study.StudyInstanceUID)
    if (
      modalities === undefined ||
      modalities.length === 0 ||
      !modalitiesNeedBackfill(study)
    ) {
      return study
    }
    return { ...study, ModalitiesInStudy: modalities }
  })
}

export interface ResolveContainsStudiesInput {
  entry: ContainsEntry
  matches: ReadonlyMap<string, ContainsMatch>
  loadedStudies: ReadonlyMap<string, dmv.metadata.Study>
  getRowCheck: ContainsRowCheckLookup
  /** True when the match still needs a row check before it can be trusted. */
  needsCheck: (studyUid: string) => boolean
}

export interface ResolveContainsStudiesResult {
  studies: dmv.metadata.Study[]
  hasUncheckedMatches: boolean
}

/**
 * Builds the study list for an active Contains filter: skip mismatches, prefer
 * loaded worklist rows, then fetched check studies, then the match stub.
 */
export function resolveContainsStudies({
  entry,
  matches,
  loadedStudies,
  getRowCheck,
  needsCheck,
}: ResolveContainsStudiesInput): ResolveContainsStudiesResult {
  const studies: dmv.metadata.Study[] = []
  let hasUncheckedMatches = false
  for (const [studyUid, match] of matches) {
    const check = getRowCheck(studyUid)
    if (check?.status === 'mismatch') continue
    if (check === undefined && needsCheck(studyUid)) {
      hasUncheckedMatches = true
    }
    const loaded = loadedStudies.get(studyUid)
    const fetched =
      check !== undefined && 'study' in check ? check.study : undefined
    studies.push(loaded ?? withEntryModality(fetched ?? match.study, entry))
  }
  return { studies, hasUncheckedMatches }
}

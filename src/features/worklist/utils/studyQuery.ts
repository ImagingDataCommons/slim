/** Pure helpers for the worklist QIDO-RS study search. */

const MODALITY_TAG = '00080060'

/** Shortest term that triggers a server-side worklist search */
export const STUDY_SEARCH_MIN_LENGTH = 2

/** Cap per QIDO search query so a pause cannot pull an unbounded page */
export const STUDY_SEARCH_RESULT_LIMIT = 100

export type StudyQueryParams = Record<string, string | number | boolean>

/**
 * Slide microscopy studies. Do not request `NumberOfStudyRelatedSeries` via
 * `includefield`: Google Healthcare (IDC) rejects that attribute with HTTP 400
 * ("not a supported … attribute"), which also breaks StudyID search queries
 * that reuse these params. Servers that return the series count by default
 * (e.g. dcm4chee) still populate the Slides column without `includefield`.
 */
export function buildStudyQueryParams(): StudyQueryParams {
  return {
    ModalitiesInStudy: 'SM',
  }
}

/**
 * QIDO queries that find the studies a worklist search refers to, one per
 * attribute and matching style. Servers differ in what they honor: Google
 * Cloud Healthcare (IDC) ignores `*` wildcards and matches only exact values
 * or fuzzy person names, while dcm4chee matches wildcards. Sending both styles
 * covers either; queries a server rejects return nothing. A term that already
 * contains `*` or `?` is sent as typed. Terms shorter than
 * {@link STUDY_SEARCH_MIN_LENGTH} skip the server (local filter still runs).
 */
export function buildStudySearchQueries(
  searchText: string,
): StudyQueryParams[] {
  const term = searchText.trim()
  if (term.length < STUDY_SEARCH_MIN_LENGTH) return []
  const values = /[*?]/.test(term) ? [term] : [term, `*${term}*`]
  return [
    ...values.map((value) => ({ PatientID: value })),
    ...values.map((value) => ({ PatientName: value, fuzzymatching: true })),
    ...values.map((value) => ({ AccessionNumber: value })),
    { StudyID: term },
  ].map((criteria) => ({
    ...buildStudyQueryParams(),
    ...criteria,
    limit: STUDY_SEARCH_RESULT_LIMIT,
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function getModality(series: unknown): string | undefined {
  if (!isRecord(series)) return undefined
  const element = series[MODALITY_TAG]
  const elementValue = isRecord(element) ? element.Value : undefined
  const value = Array.isArray(elementValue) ? elementValue[0] : series.Modality
  if (value === undefined || value === null) return undefined
  const modality = String(value).trim()
  return modality === '' ? undefined : modality
}

/**
 * Sorted, de-duplicated Modality values of QIDO series results, accepting
 * both DICOM JSON (`00080060`) and keyword-formatted (`Modality`) entries.
 */
export function extractModalitiesFromSeries(series: unknown[]): string[] {
  const modalities = new Set<string>()
  series.forEach((item) => {
    const modality = getModality(item)
    if (modality !== undefined) modalities.add(modality)
  })
  return [...modalities].sort((a, b) => a.localeCompare(b))
}

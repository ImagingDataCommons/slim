/** Pure helpers for the worklist QIDO-RS study search. */

const MODALITY_TAG = '00080060'

export type StudyQueryParams = Record<string, string | number | boolean>

export function buildStudyQueryParams(
  searchCriteria?: Record<string, string>,
): StudyQueryParams {
  const queryParams: StudyQueryParams = {
    ModalitiesInStudy: 'SM',
    includefield: 'NumberOfStudyRelatedSeries',
  }
  if (searchCriteria === undefined) return queryParams
  Object.entries(searchCriteria).forEach(([key, value]) => {
    queryParams[key] = key === 'PersonName' ? `*${value}*` : value
  })
  queryParams.fuzzymatching = true
  return queryParams
}

function getModality(series: unknown): string | undefined {
  if (series === null || typeof series !== 'object') return undefined
  const record = series as Record<string, unknown>
  const element = record[MODALITY_TAG] as { Value?: unknown[] } | undefined
  const value = Array.isArray(element?.Value)
    ? element?.Value[0]
    : record.Modality
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
  return [...modalities].sort()
}

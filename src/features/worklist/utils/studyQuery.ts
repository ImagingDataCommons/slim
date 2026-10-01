/** Pure helpers for the worklist QIDO-RS study search. */

const MODALITY_TAG = '00080060'

export type StudyQueryParams = Record<string, string | number | boolean>

/** Slide microscopy studies, with the series count used for "Slides". */
export function buildStudyQueryParams(): StudyQueryParams {
  return {
    ModalitiesInStudy: 'SM',
    includefield: 'NumberOfStudyRelatedSeries',
  }
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

/** Pure accessors that turn QIDO study attributes into worklist cell values. */

export const DASH = '\u2014'

export function orDash(value: string | undefined | null): string {
  return value === undefined || value === null || value === '' ? DASH : value
}

/** NumberOfStudyRelatedSeries as a finite number, if the server returned one. */
export function getNumberOfSlides(study: object): number | undefined {
  const value = (study as { NumberOfStudyRelatedSeries?: unknown })
    .NumberOfStudyRelatedSeries
  const count = typeof value === 'string' ? Number.parseInt(value, 10) : value
  return typeof count === 'number' && Number.isFinite(count) ? count : undefined
}

/**
 * ModalitiesInStudy as a de-duplicated list. Single strings may hold several
 * values separated by DICOM backslashes or commas.
 */
export function normalizeModalities(value: unknown): string[] {
  let candidates: unknown[]
  if (Array.isArray(value)) {
    candidates = value
  } else if (typeof value === 'string') {
    candidates = value.split(/[\\,]/)
  } else {
    candidates = []
  }
  const modalities = candidates
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item).trim())
    .filter((item) => item !== '')
  return [...new Set(modalities)]
}

/**
 * Pure functions for filtering and searching study data.
 * No side effects - suitable for unit testing.
 */

/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { parseDicomDate } from '../../../utils/dicom/datetime'
import { formatRawPersonName } from '../../../utils/dicom/personName'
import { formatPersonName } from '../../../utils/displayFormat'
import { normalizeModalities } from './studyFields'

export { parseDicomDate }

export type DateFilter = 'all' | 'today' | 'week'

/** Number of calendar days, including today, covered by the "week" filter. */
export const WEEK_FILTER_DAYS = 7

/**
 * Checks if a date falls on the same calendar day as `now`.
 */
export function isToday(date: Date, now: Date = new Date()): boolean {
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

/**
 * Checks if a date lies within the last `days` calendar days, today included
 * (so `days = 7` covers today and the 6 previous days). Future dates are
 * excluded.
 */
export function isWithinLastDays(
  date: Date,
  days: number,
  now: Date = new Date(),
): boolean {
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (days - 1),
  )
  return date >= cutoff && date <= now
}

/**
 * Filters studies by date range.
 */
export function filterStudiesByDateRange(
  studies: dmv.metadata.Study[],
  range: DateFilter,
  now: Date = new Date(),
): dmv.metadata.Study[] {
  if (range === 'all') {
    return studies
  }

  return studies.filter((study) => {
    const date = parseDicomDate(study.StudyDate)
    if (date === null) {
      return false
    }

    if (range === 'today') {
      return isToday(date, now)
    }

    return isWithinLastDays(date, WEEK_FILTER_DAYS, now)
  })
}

/** Empty-state message of the worklist table for the active date filter. */
/** Empty-state text naming the active date filter and search query. */
export function getEmptyStudiesMessage(
  range: DateFilter,
  searchText = '',
): string {
  const query = searchText.trim()
  const scope =
    range === 'today'
      ? 'No studies from today'
      : range === 'week'
        ? `No studies in the last ${WEEK_FILTER_DAYS} days`
        : undefined
  if (query !== '') {
    return `${scope ?? 'No studies'} match “${query}”.`
  }
  return `${scope ?? 'No studies found'}.`
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
        field !== undefined &&
        field !== null &&
        String(field).toLowerCase().includes(search),
    )
  })
}

/**
 * True when QIDO did not return usable ModalitiesInStudy.
 */
export function modalitiesNeedBackfill(study: dmv.metadata.Study): boolean {
  return normalizeModalities(study.ModalitiesInStudy).length === 0
}

/**
 * Pure functions for filtering and searching study data.
 * No side effects - suitable for unit testing.
 */

// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'

import { formatPersonName } from '../../../utils/displayFormat'
import { normalizeModalities } from './studyFields'

export type DateFilter = 'all' | 'today' | 'week'

/**
 * Parses a DICOM date string (YYYYMMDD) to a Date object.
 * Returns null if the date is invalid.
 */
export function parseDicomDate(
  dateString: string | undefined | null,
): Date | null {
  if (dateString?.length !== 8) {
    return null
  }

  const year = Number.parseInt(dateString.substring(0, 4), 10)
  const month = Number.parseInt(dateString.substring(4, 6), 10) - 1
  const day = Number.parseInt(dateString.substring(6, 8), 10)

  const date = new Date(year, month, day)

  /** Verify the date is valid */
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

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
 * Checks if a date lies between the start of the day `days` days before
 * `now` and `now` itself (future dates are excluded).
 */
export function isWithinLastDays(
  date: Date,
  days: number,
  now: Date = new Date(),
): boolean {
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
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
    const date = parseDicomDate(study.StudyDate as string | undefined)
    if (!date) {
      return false
    }

    if (range === 'today') {
      return isToday(date, now)
    }

    if (range === 'week') {
      return isWithinLastDays(date, 7, now)
    }

    return true
  })
}

type PersonNameValue = Parameters<typeof formatPersonName>[0]

/** Alphabetic PN components joined by spaces, e.g. "Doe^Jane" → "Doe Jane". */
function getRawPersonName(value: PersonNameValue): string {
  let alphabetic: string | undefined
  if (typeof value === 'string') {
    alphabetic = value
  } else if (Array.isArray(value)) {
    const first = value[0]
    alphabetic = typeof first === 'string' ? first : first?.Alphabetic
  } else if (value !== null && value !== undefined) {
    alphabetic = value.Alphabetic
  }
  return (alphabetic ?? '').replace(/\^/g, ' ').replace(/\s+/g, ' ').trim()
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
    const patientName = study.PatientName as PersonNameValue
    const fields: unknown[] = [
      study.AccessionNumber,
      study.StudyID,
      study.PatientID,
      formatPersonName(patientName),
      getRawPersonName(patientName),
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

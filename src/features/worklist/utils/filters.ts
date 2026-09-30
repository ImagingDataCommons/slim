/**
 * Pure functions for filtering and searching study data.
 * No side effects - suitable for unit testing.
 */

// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'

export type DateFilter = 'all' | 'today' | 'week'

/**
 * Parses a DICOM date string (YYYYMMDD) to a Date object.
 * Returns null if the date is invalid.
 */
export function parseDicomDate(
  dateString: string | undefined | null,
): Date | null {
  if (!dateString || dateString.length !== 8) {
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
 * Checks if a date is today.
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Checks if a date is within the last N days.
 */
export function isWithinLastDays(date: Date, days: number): boolean {
  const now = new Date()
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return date >= cutoff
}

/**
 * Filters studies by date range.
 */
export function filterStudiesByDateRange(
  studies: dmv.metadata.Study[],
  range: DateFilter,
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
      return isToday(date)
    }

    if (range === 'week') {
      return isWithinLastDays(date, 7)
    }

    return true
  })
}

/**
 * Filters studies by search text across multiple fields.
 */
export function filterStudiesBySearchText(
  studies: dmv.metadata.Study[],
  searchText: string,
): dmv.metadata.Study[] {
  if (!searchText.trim()) {
    return studies
  }

  const search = searchText.toLowerCase().trim()

  return studies.filter((study) => {
    const fields = [
      study.AccessionNumber as string | undefined,
      study.StudyID as string | undefined,
      study.PatientID as string | undefined,
      formatPatientName(study.PatientName),
    ]

    return fields.some((field) => {
      if (!field) return false
      return String(field).toLowerCase().includes(search)
    })
  })
}

/**
 * Formats a DICOM PersonName to a display string.
 */
export function formatPatientName(
  name: dmv.metadata.PersonName | string | undefined | null,
): string {
  if (!name) {
    return ''
  }

  if (typeof name === 'string') {
    return name.replace(/\^/g, ' ').trim()
  }

  /** Handle PersonName object - dmv uses Alphabetic representation */
  if (typeof name === 'object' && name.Alphabetic !== undefined) {
    return name.Alphabetic.replace(/\^/g, ' ').trim()
  }

  return ''
}

/**
 * True when QIDO did not return usable ModalitiesInStudy.
 */
export function modalitiesNeedBackfill(study: dmv.metadata.Study): boolean {
  const m = study.ModalitiesInStudy as string | string[] | undefined | null
  if (m === undefined || m === null) {
    return true
  }
  if (typeof m === 'string') {
    return m.trim() === ''
  }
  if (Array.isArray(m)) {
    return m.length === 0 || m.every((x) => String(x ?? '').trim() === '')
  }
  return true
}

/**
 * Formats ModalitiesInStudy for display.
 */
export function formatModalitiesInStudy(
  value: string[] | string | undefined | null,
): string {
  if (value === undefined || value === null) {
    return ''
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return ''
    }
    return value.map(String).join(', ')
  }
  return String(value)
}

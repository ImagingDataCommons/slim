/**
 * Pure functions for sorting study data.
 * No side effects - suitable for unit testing.
 */

// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'

import { formatPatientName, parseDicomDate } from './filters'

export type SortDirection = 'asc' | 'desc'

export type SortField =
  | 'AccessionNumber'
  | 'StudyID'
  | 'StudyDate'
  | 'StudyTime'
  | 'PatientID'
  | 'PatientName'
  | 'PatientSex'
  | 'PatientBirthDate'
  | 'ReferringPhysicianName'
  | 'ModalitiesInStudy'

/**
 * Compares two string values for sorting.
 */
function compareStrings(
  a: string,
  b: string,
  direction: SortDirection,
): number {
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' })
  return direction === 'asc' ? result : -result
}

/**
 * Compares two Date values for sorting.
 */
function compareDates(
  a: Date | null,
  b: Date | null,
  direction: SortDirection,
): number {
  if (a === null && b === null) return 0
  if (a === null) return direction === 'asc' ? 1 : -1
  if (b === null) return direction === 'asc' ? -1 : 1

  const result = a.getTime() - b.getTime()
  return direction === 'asc' ? result : -result
}

/**
 * Gets a comparable string value from a study field.
 */
function getStringValue(study: dmv.metadata.Study, field: SortField): string {
  switch (field) {
    case 'AccessionNumber':
      return String(study.AccessionNumber ?? '')
    case 'StudyID':
      return String(study.StudyID ?? '')
    case 'PatientID':
      return String(study.PatientID ?? '')
    case 'PatientName':
      return formatPatientName(study.PatientName)
    case 'PatientSex':
      return String(study.PatientSex ?? '')
    case 'ReferringPhysicianName':
      return formatPatientName(
        study.ReferringPhysicianName as dmv.metadata.PersonName,
      )
    case 'ModalitiesInStudy': {
      const mods = study.ModalitiesInStudy
      if (Array.isArray(mods)) {
        return mods.join(', ')
      }
      return String(mods ?? '')
    }
    default:
      return ''
  }
}

/**
 * Gets a comparable Date value from a study field.
 */
function getDateValue(
  study: dmv.metadata.Study,
  field: SortField,
): Date | null {
  switch (field) {
    case 'StudyDate':
      return parseDicomDate(study.StudyDate as string | undefined)
    case 'PatientBirthDate':
      return parseDicomDate(study.PatientBirthDate as string | undefined)
    default:
      return null
  }
}

/**
 * Sorts studies by a single field.
 */
export function sortStudies(
  studies: dmv.metadata.Study[],
  field: SortField,
  direction: SortDirection,
): dmv.metadata.Study[] {
  const isDateField = field === 'StudyDate' || field === 'PatientBirthDate'

  return [...studies].sort((a, b) => {
    if (isDateField) {
      const dateA = getDateValue(a, field)
      const dateB = getDateValue(b, field)
      return compareDates(dateA, dateB, direction)
    }

    const strA = getStringValue(a, field)
    const strB = getStringValue(b, field)
    return compareStrings(strA, strB, direction)
  })
}

/**
 * Creates a comparator function for TanStack Table.
 */
export function createSortComparator(
  field: SortField,
): (a: dmv.metadata.Study, b: dmv.metadata.Study) => number {
  const isDateField = field === 'StudyDate' || field === 'PatientBirthDate'

  return (a, b) => {
    if (isDateField) {
      const dateA = getDateValue(a, field)
      const dateB = getDateValue(b, field)
      return compareDates(dateA, dateB, 'asc')
    }

    const strA = getStringValue(a, field)
    const strB = getStringValue(b, field)
    return compareStrings(strA, strB, 'asc')
  }
}

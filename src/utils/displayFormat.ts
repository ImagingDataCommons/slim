/**
 * Display formatters for the Slim v2 design: "12 Sep 2026", "09:42",
 * "Whitfield, Margaret A." and space-grouped numbers ("18 402").
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** DICOM DA (YYYYMMDD, optionally with separators) → "12 Sep 2026". */
export function formatDisplayDate(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length < 8) return value.trim()
  const year = digits.substring(0, 4)
  const month = Number(digits.substring(4, 6))
  const day = Number(digits.substring(6, 8))
  if (month < 1 || month > 12 || day < 1 || day > 31) return value.trim()
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`
}

/** DICOM TM (HHMMSS.frac, optionally with colons) → "09:42". */
export function formatDisplayTime(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const digits = value.split('.')[0].replace(/[^0-9]/g, '')
  if (digits.length < 4) return value.trim()
  return `${digits.substring(0, 2)}:${digits.substring(2, 4)}`
}

export type PersonNameValue =
  | string
  | { Alphabetic?: string }
  | Array<{ Alphabetic?: string } | string>
  | null
  | undefined

/**
 * DICOM PN → "Family, Given M." — middle names are shortened to initials;
 * prefix/suffix components are kept around the name.
 */
export function formatPersonName(value: PersonNameValue): string {
  let alphabetic: string | undefined
  if (typeof value === 'string') {
    alphabetic = value
  } else if (Array.isArray(value)) {
    const first = value[0]
    alphabetic = typeof first === 'string' ? first : first?.Alphabetic
  } else if (value !== null && value !== undefined) {
    alphabetic = value.Alphabetic
  }
  if (alphabetic === undefined || alphabetic.trim() === '') return ''
  const [family = '', given = '', middle = '', prefix = '', suffix = ''] =
    alphabetic.split('^').map((part) => part.trim())
  const middleInitials = middle
    .split(/\s+/)
    .filter((part) => part !== '')
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(' ')
  const givenPart = [given, middleInitials]
    .filter((part) => part !== '')
    .join(' ')
  const core =
    family !== '' && givenPart !== ''
      ? `${family}, ${givenPart}`
      : family !== ''
        ? family
        : givenPart
  return [prefix, core, suffix].filter((part) => part !== '').join(' ')
}

/** "12 Sep 2026, 09:42" from DICOM StudyDate/StudyTime. */
export function formatStudyDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  return [formatDisplayDate(date), formatDisplayTime(time)]
    .filter((part) => part !== '')
    .join(', ')
}

/** "S24-01542 · 12 Sep 2026"; the accession number stands in for a missing Study ID. */
export function formatStudyLabel(
  studyID: string | null | undefined,
  accessionNumber: string | null | undefined,
  studyDate: string | null | undefined,
): string {
  const identifier =
    studyID !== undefined && studyID !== null && studyID.trim() !== ''
      ? studyID.trim()
      : (accessionNumber?.trim() ?? '')
  return [identifier, formatDisplayDate(studyDate)]
    .filter((part) => part !== '')
    .join(' · ')
}

export interface StudySummarySource {
  PatientName?: PersonNameValue
  StudyID?: string
  AccessionNumber?: string
  StudyDate?: string
}

export interface StudySummaryLabels {
  patientName: string
  studyLabel: string
}

/** Header breadcrumb labels for a study's reference image. */
export function buildStudySummary(
  image: StudySummarySource,
): StudySummaryLabels {
  return {
    patientName: formatPersonName(image.PatientName),
    studyLabel: formatStudyLabel(
      image.StudyID,
      image.AccessionNumber,
      image.StudyDate,
    ),
  }
}

/** Integer with space thousands separators: 18402 → "18 402". */
export function formatGroupedNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '-' : ''
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** DICOM CS sex code → "Female" / "Male" / "Other". */
export function formatSex(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const lookup: Record<string, string> = { F: 'Female', M: 'Male', O: 'Other' }
  return lookup[value.trim().toUpperCase()] ?? value
}

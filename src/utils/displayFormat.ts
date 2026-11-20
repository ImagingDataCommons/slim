/**
 * Display formatters for the Slim v2 design: "12 Sep 2026", "09:42",
 * "Whitfield, Margaret A." and space-grouped numbers ("18 402").
 */

import { formatCodedConceptSequence } from './dicom/codedConcept'
import { parseDicomDateParts } from './dicom/datetime'
import { getAlphabeticName, type PersonNameValue } from './dicom/personName'

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

/**
 * DICOM DA (YYYYMMDD, optionally with separators) → "12 Sep 2026". Only the
 * first eight digits are read, so DT values format as their date.
 */
export function formatDisplayDate(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const parts = parseDicomDateParts(
    value.replace(/[^0-9]/g, '').substring(0, 8),
  )
  if (parts === null) return value.trim()
  return `${String(parts.day).padStart(2, '0')} ${MONTHS[parts.month - 1]} ${parts.year}`
}

/** DICOM TM (HHMMSS.frac, optionally with colons) → "09:42". */
export function formatDisplayTime(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const digits = value.split('.')[0].replace(/[^0-9]/g, '')
  if (digits.length < 4) return value.trim()
  return `${digits.substring(0, 2)}:${digits.substring(2, 4)}`
}

/**
 * DICOM PN → "Family, Given M." — middle names are shortened to initials;
 * prefix/suffix components are kept around the name.
 */
export function formatPersonName(value: PersonNameValue): string {
  const alphabetic = getAlphabeticName(value)
  if (alphabetic.trim() === '') return ''
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

/** Multi-valued DICOM attribute (e.g. SoftwareVersions) as "a, b"; empty if absent. */
export function formatMultiValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatMultiValue(item))
      .filter((item) => item !== '')
      .join(', ')
  }
  if (typeof value === 'string') {
    return value
      .split('\\')
      .map((item) => item.trim())
      .filter((item) => item !== '')
      .join(', ')
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

/** (00102202) PatientSpeciesCodeSequence — meanings only; undefined if absent or empty. */
export function formatPatientSpeciesCodeSequence(
  sequence: unknown,
): string | undefined {
  const text = formatCodedConceptSequence(sequence)
  return text !== '' ? text : undefined
}

function firstNonEmpty<T>(
  metadata: Record<string, unknown>,
  keys: readonly string[],
  read: (value: unknown) => T | undefined,
): T | undefined {
  for (const key of keys) {
    const value = read(metadata[key])
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * (0008,1080) LO + (0008,1084) SQ (standard keywords use plural "Diagnoses").
 * Also accepts singular / legacy keys (e.g. dcmjs) for interoperability.
 */
export function formatAdmittingDiagnoses(
  metadata: Record<string, unknown>,
): string | undefined {
  const description =
    firstNonEmpty(
      metadata,
      ['AdmittingDiagnosesDescription', 'AdmittingDiagnosisDescription'],
      (value): string | undefined =>
        typeof value === 'string' && value.trim() !== ''
          ? value.trim()
          : undefined,
    ) ?? ''
  const sequence = firstNonEmpty(
    metadata,
    [
      'AdmittingDiagnosesCodeSequence',
      'AdmittingDiagnosisCodeSequence',
      'AdmittingDiagnosisCodeSeq',
    ],
    (value): unknown[] | undefined =>
      Array.isArray(value) && value.length > 0 ? value : undefined,
  )
  const codes = formatCodedConceptSequence(sequence)

  if (description !== '' && codes !== '') {
    return description.toLowerCase() === codes.toLowerCase()
      ? description
      : `${description}; ${codes}`
  }
  if (description !== '') return description
  if (codes !== '') return codes
  return undefined
}

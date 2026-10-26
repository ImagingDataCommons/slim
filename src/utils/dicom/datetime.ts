/**
 * DICOM DA values are `YYYYMMDD`; legacy ACR-NEMA data also uses
 * `YYYY.MM.DD`, and some archives return `YYYY-MM-DD`. The separator must be
 * the same in both positions.
 */
const DICOM_DATE_PATTERN = /^(\d{4})([./-]?)(\d{2})\2(\d{2})$/

export interface DicomDateParts {
  year: number
  /** 1-based month */
  month: number
  day: number
}

/** Calendar parts of a DICOM date, or null when malformed or impossible. */
export function parseDicomDateParts(
  value: string | null | undefined,
): DicomDateParts | null {
  if (value === null || value === undefined) return null
  const match = DICOM_DATE_PATTERN.exec(value.trim())
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[3])
  const day = Number(match[4])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

/** Local midnight of a DICOM date, or null when malformed or impossible. */
export function parseDicomDate(value: string | null | undefined): Date | null {
  const parts = parseDicomDateParts(value)
  if (parts === null) return null
  return new Date(parts.year, parts.month - 1, parts.day)
}

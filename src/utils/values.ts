// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'

function parseName(value: dmv.metadata.PersonName | null | undefined): string {
  if (typeof value === 'object' && value !== null && value !== undefined) {
    if (value.Alphabetic !== undefined) {
      return value.Alphabetic.split('^').join(' ')
    }
    return ''
  }
  return ''
}

function parseDate(value: string | null | undefined): string {
  if (value !== null && value !== undefined) {
    const year = value.substring(0, 4)
    const month = value.substring(4, 6)
    const day = value.substring(6, 8)
    return `${year}-${month}-${day}`
  }
  return ''
}

function parseTime(value: string | null | undefined): string {
  if (value !== null && value !== undefined) {
    const hours = value.substring(0, 2)
    const minutes = value.substring(2, 4)
    const seconds = value.substring(4, 6)
    return `${hours}:${minutes}:${seconds}`
  }
  return ''
}

function parseDateTime(value: string | null | undefined): string {
  if (value !== null && value !== undefined) {
    const year = value.substring(0, 4)
    const month = value.substring(4, 6)
    const day = value.substring(6, 8)
    const hours = value.substring(8, 10)
    const minutes = value.substring(10, 12)
    const seconds = value.substring(12, 14)
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
  return ''
}

function parseSex(value: string | null | undefined): string {
  const lut: { [key: string]: string } = {
    F: 'Female',
    M: 'Male',
    O: 'Other',
  }
  if (value !== null && value !== undefined) {
    return lut[value]
  }
  return ''
}

/**
 * Human-readable text for a DICOM coded concept: prefer CodeMeaning.
 * Does not show SNOMED CT numeric codes (SCT) when meaning is absent.
 */
function codedConceptDisplayText(item: unknown): string {
  if (item == null || typeof item !== 'object') return ''
  const o = item as {
    CodeValue?: string
    CodeMeaning?: string
    CodingSchemeDesignator?: string
  }
  const cm = (o.CodeMeaning ?? '').trim()
  if (cm !== '') return cm
  const scheme = (o.CodingSchemeDesignator ?? '').toUpperCase()
  if (scheme === 'SCT') return ''
  return (o.CodeValue ?? '').trim()
}

function dedupeStringsPreserveOrder(strings: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of strings) {
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

/** (00102202) PatientSpeciesCodeSequence — meanings only; undefined if absent or empty. */
function formatPatientSpeciesCodeSequence(
  sequence: unknown,
): string | undefined {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return undefined
  }
  const parts: string[] = []
  for (const item of sequence) {
    const part = codedConceptDisplayText(item)
    if (part !== '') parts.push(part)
  }
  const unique = dedupeStringsPreserveOrder(parts)
  return unique.length > 0 ? unique.join(', ') : undefined
}

export {
  codedConceptDisplayText,
  dedupeStringsPreserveOrder,
  formatPatientSpeciesCodeSequence,
  parseDate,
  parseDateTime,
  parseName,
  parseSex,
  parseTime,
}

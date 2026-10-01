import type { PersonNameValue } from './displayFormat'

/** Alphabetic component group of a DICOM PN, e.g. "Doe^Jane", or ''. */
export function getAlphabeticName(value: PersonNameValue): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const first = value[0]
    return (typeof first === 'string' ? first : first?.Alphabetic) ?? ''
  }
  return value?.Alphabetic ?? ''
}

/** Alphabetic PN components joined by spaces, e.g. "Doe^Jane" → "Doe Jane". */
export function formatRawPersonName(value: PersonNameValue): string {
  return getAlphabeticName(value)
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface CodedConceptLike {
  CodeValue?: string
  CodingSchemeDesignator?: string
  CodeMeaning?: string
}

/** `SCHEME:VALUE`; CodeValue may contain hyphens, so ':' separates the parts. */
export function codedConceptKey(concept: CodedConceptLike): string {
  return `${concept.CodingSchemeDesignator ?? ''}:${concept.CodeValue ?? ''}`
}

/** Concepts are equal when scheme and value match; meanings may differ. */
export function isSameCodedConcept(
  a: CodedConceptLike,
  b: CodedConceptLike,
): boolean {
  return (
    a.CodeValue === b.CodeValue &&
    a.CodingSchemeDesignator === b.CodingSchemeDesignator
  )
}

function isCodedConceptLike(item: unknown): item is CodedConceptLike {
  return typeof item === 'object' && item !== null
}

/**
 * Human-readable text for a DICOM coded concept: prefer CodeMeaning.
 * Does not show SNOMED CT numeric codes (SCT) when meaning is absent.
 */
export function codedConceptDisplayText(item: unknown): string {
  if (!isCodedConceptLike(item)) return ''
  const meaning = (item.CodeMeaning ?? '').trim()
  if (meaning !== '') return meaning
  const scheme = (item.CodingSchemeDesignator ?? '').toUpperCase()
  if (scheme === 'SCT') return ''
  return (item.CodeValue ?? '').trim()
}

/** Display texts of a code sequence, case-insensitively deduplicated, joined by ", ". */
export function formatCodedConceptSequence(sequence: unknown): string {
  if (!Array.isArray(sequence)) return ''
  const seen = new Set<string>()
  const parts: string[] = []
  for (const item of sequence) {
    const text = codedConceptDisplayText(item)
    const key = text.toLowerCase()
    if (text === '' || seen.has(key)) continue
    seen.add(key)
    parts.push(text)
  }
  return parts.join(', ')
}

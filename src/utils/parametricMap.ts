interface RealWorldValueMappingLike {
  RealWorldValueFirstValueMapped?: unknown
  RealWorldValueLastValueMapped?: unknown
}

interface FunctionalGroupLike {
  RealWorldValueMappingSequence?: RealWorldValueMappingLike[]
}

export interface ParametricMapDatasetLike {
  RealWorldValueMappingSequence?: RealWorldValueMappingLike[]
  SharedFunctionalGroupsSequence?: FunctionalGroupLike[]
  PerFrameFunctionalGroupsSequence?: FunctionalGroupLike[]
}

export interface ValueRange {
  first: number
  last: number
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function rangeFromMapping(
  mapping: RealWorldValueMappingLike | undefined,
): ValueRange | undefined {
  const first = toFiniteNumber(mapping?.RealWorldValueFirstValueMapped)
  const last = toFiniteNumber(mapping?.RealWorldValueLastValueMapped)
  if (first === undefined || last === undefined) return undefined
  return { first, last }
}

/**
 * Mapped value range of the first Real World Value Mapping item, looked up in
 * the shared functional groups, the first per-frame functional group and the
 * top-level dataset (in that order).
 */
export function getRealWorldValueRange(
  dataset: ParametricMapDatasetLike | undefined,
): ValueRange | undefined {
  if (dataset === undefined || dataset === null) return undefined
  const candidates = [
    dataset.SharedFunctionalGroupsSequence?.[0]
      ?.RealWorldValueMappingSequence?.[0],
    dataset.PerFrameFunctionalGroupsSequence?.[0]
      ?.RealWorldValueMappingSequence?.[0],
    dataset.RealWorldValueMappingSequence?.[0],
  ]
  for (const candidate of candidates) {
    const range = rangeFromMapping(candidate)
    if (range !== undefined) return range
  }
  return undefined
}

function formatSignificant(value: number, significantDigits: number): string {
  if (value === 0) return '0'
  return String(Number(value.toPrecision(significantDigits)))
}

/** "0.0012 – 0.0045" style label; keeps small ranges distinguishable */
export function formatValueRange(
  range: ValueRange,
  significantDigits = 3,
): string {
  return `${formatSignificant(range.first, significantDigits)} – ${formatSignificant(
    range.last,
    significantDigits,
  )}`
}

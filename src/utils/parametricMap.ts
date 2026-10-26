import { toFiniteNumber } from './numbers'

interface RealWorldValueMappingLike {
  RealWorldValueFirstValueMapped?: unknown
  RealWorldValueLastValueMapped?: unknown
  DoubleFloatRealWorldValueFirstValueMapped?: unknown
  DoubleFloatRealWorldValueLastValueMapped?: unknown
  RealWorldValueSlope?: unknown
  RealWorldValueIntercept?: unknown
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

/**
 * Real-world bounds of one mapping item, matching DMV: stored first/last
 * (or DoubleFloat first/last) through slope and intercept.
 */
function rangeFromMapping(
  mapping: RealWorldValueMappingLike | undefined,
): ValueRange | undefined {
  if (mapping === undefined) return undefined
  let first = toFiniteNumber(mapping.RealWorldValueFirstValueMapped)
  let last = toFiniteNumber(mapping.RealWorldValueLastValueMapped)
  if (first === undefined && last === undefined) {
    first = toFiniteNumber(mapping.DoubleFloatRealWorldValueFirstValueMapped)
    last = toFiniteNumber(mapping.DoubleFloatRealWorldValueLastValueMapped)
  }
  const slope = toFiniteNumber(mapping.RealWorldValueSlope)
  const intercept = toFiniteNumber(mapping.RealWorldValueIntercept)
  if (
    first === undefined ||
    last === undefined ||
    slope === undefined ||
    intercept === undefined
  ) {
    return undefined
  }
  const bound1 = first * slope + intercept
  const bound2 = last * slope + intercept
  return { first: Math.min(bound1, bound2), last: Math.max(bound1, bound2) }
}

/** Union of real-world ranges across every item of a mapping sequence */
function rangeFromSequence(
  sequence: RealWorldValueMappingLike[] | undefined,
): ValueRange | undefined {
  if (sequence === undefined || sequence.length === 0) return undefined
  let first = Number.POSITIVE_INFINITY
  let last = Number.NEGATIVE_INFINITY
  let found = false
  for (const item of sequence) {
    const range = rangeFromMapping(item)
    if (range === undefined) continue
    first = Math.min(first, range.first)
    last = Math.max(last, range.last)
    found = true
  }
  return found ? { first, last } : undefined
}

/**
 * Mapped real-world value range of the Real World Value Mapping Sequence,
 * looked up in the shared functional groups, the first per-frame functional
 * group and the top-level dataset (in that order).
 */
export function getRealWorldValueRange(
  dataset: ParametricMapDatasetLike | undefined,
): ValueRange | undefined {
  if (dataset === undefined || dataset === null) return undefined
  const candidates = [
    dataset.SharedFunctionalGroupsSequence?.[0]?.RealWorldValueMappingSequence,
    dataset.PerFrameFunctionalGroupsSequence?.[0]
      ?.RealWorldValueMappingSequence,
    dataset.RealWorldValueMappingSequence,
  ]
  for (const candidate of candidates) {
    const range = rangeFromSequence(candidate)
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

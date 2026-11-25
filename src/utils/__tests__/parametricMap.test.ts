import { formatValueRange, getRealWorldValueRange } from '../parametricMap'

const mappingItem = (
  first: unknown,
  last: unknown,
  {
    slope = 1,
    intercept = 0,
    doubleFloat = false,
  }: { slope?: unknown; intercept?: unknown; doubleFloat?: boolean } = {},
) =>
  doubleFloat
    ? {
        DoubleFloatRealWorldValueFirstValueMapped: first,
        DoubleFloatRealWorldValueLastValueMapped: last,
        RealWorldValueSlope: slope,
        RealWorldValueIntercept: intercept,
      }
    : {
        RealWorldValueFirstValueMapped: first,
        RealWorldValueLastValueMapped: last,
        RealWorldValueSlope: slope,
        RealWorldValueIntercept: intercept,
      }

const mapping = (
  first: unknown,
  last: unknown,
  options?: { slope?: unknown; intercept?: unknown; doubleFloat?: boolean },
) => ({
  RealWorldValueMappingSequence: [mappingItem(first, last, options)],
})

describe('getRealWorldValueRange', () => {
  it('reads the shared functional groups first', () => {
    expect(
      getRealWorldValueRange({
        SharedFunctionalGroupsSequence: [mapping(0, 1)],
        PerFrameFunctionalGroupsSequence: [mapping(2, 3)],
        ...mapping(4, 5),
      }),
    ).toEqual({ first: 0, last: 1 })
  })

  it('falls back to the first per-frame functional group', () => {
    expect(
      getRealWorldValueRange({
        SharedFunctionalGroupsSequence: [{}],
        PerFrameFunctionalGroupsSequence: [mapping(-1, 1)],
      }),
    ).toEqual({ first: -1, last: 1 })
  })

  it('falls back to the top-level sequence and parses numeric strings', () => {
    expect(getRealWorldValueRange(mapping('0.5', '2'))).toEqual({
      first: 0.5,
      last: 2,
    })
  })

  it('applies slope and intercept like DMV', () => {
    const range = getRealWorldValueRange(
      mapping(0, 255, { slope: 0.01, intercept: -1 }),
    )
    expect(range?.first).toBe(-1)
    expect(range?.last).toBeCloseTo(1.55)
  })

  it('reads DoubleFloat first/last when integer attributes are absent', () => {
    expect(
      getRealWorldValueRange(
        mapping(0.25, 0.75, { doubleFloat: true, slope: 2, intercept: 1 }),
      ),
    ).toEqual({ first: 1.5, last: 2.5 })
  })

  it('takes min/max across every mapping item in the sequence', () => {
    expect(
      getRealWorldValueRange({
        RealWorldValueMappingSequence: [
          mappingItem(10, 20, { slope: 1, intercept: 0 }),
          mappingItem(0, 5, { slope: 2, intercept: -1 }),
        ],
      }),
    ).toEqual({ first: -1, last: 20 })
  })

  it('returns undefined for missing or invalid values', () => {
    expect(getRealWorldValueRange(undefined)).toBeUndefined()
    expect(getRealWorldValueRange({})).toBeUndefined()
    expect(getRealWorldValueRange(mapping(0, 'abc'))).toBeUndefined()
    expect(getRealWorldValueRange(mapping(undefined, 1))).toBeUndefined()
    expect(
      getRealWorldValueRange({
        RealWorldValueMappingSequence: [
          {
            RealWorldValueFirstValueMapped: 0,
            RealWorldValueLastValueMapped: 1,
          },
        ],
      }),
    ).toBeUndefined()
  })
})

describe('formatValueRange', () => {
  it('formats typical ranges', () => {
    expect(formatValueRange({ first: 0, last: 1 })).toBe('0 – 1')
    expect(formatValueRange({ first: -12.345, last: 987.65 })).toBe(
      '-12.3 – 988',
    )
  })

  it('keeps small ranges distinguishable', () => {
    expect(formatValueRange({ first: 0.00123, last: 0.0456 })).toBe(
      '0.00123 – 0.0456',
    )
  })

  it('honours significant digits', () => {
    expect(formatValueRange({ first: 1.23456, last: 2.34567 }, 2)).toBe(
      '1.2 – 2.3',
    )
  })
})

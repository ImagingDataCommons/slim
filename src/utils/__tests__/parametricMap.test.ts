import { formatValueRange, getRealWorldValueRange } from '../parametricMap'

const mapping = (first: unknown, last: unknown) => ({
  RealWorldValueMappingSequence: [
    {
      RealWorldValueFirstValueMapped: first,
      RealWorldValueLastValueMapped: last,
    },
  ],
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

  it('returns undefined for missing or invalid values', () => {
    expect(getRealWorldValueRange(undefined)).toBeUndefined()
    expect(getRealWorldValueRange({})).toBeUndefined()
    expect(getRealWorldValueRange(mapping(0, 'abc'))).toBeUndefined()
    expect(getRealWorldValueRange(mapping(undefined, 1))).toBeUndefined()
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

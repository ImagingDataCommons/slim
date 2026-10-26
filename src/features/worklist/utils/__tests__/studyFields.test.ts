import {
  DASH,
  getNumberOfSeries,
  normalizeModalities,
  orDash,
} from '../studyFields'

describe('orDash', () => {
  it('replaces empty values with a dash', () => {
    expect(orDash(undefined)).toBe(DASH)
    expect(orDash(null)).toBe(DASH)
    expect(orDash('')).toBe(DASH)
  })

  it('keeps non-empty values', () => {
    expect(orDash('S24-01542')).toBe('S24-01542')
    expect(orDash(' ')).toBe(' ')
  })
})

describe('getNumberOfSeries', () => {
  it('reads numeric and string counts', () => {
    expect(getNumberOfSeries({ NumberOfStudyRelatedSeries: 4 })).toBe(4)
    expect(getNumberOfSeries({ NumberOfStudyRelatedSeries: '12' })).toBe(12)
    expect(getNumberOfSeries({ NumberOfStudyRelatedSeries: 0 })).toBe(0)
  })

  it('returns undefined for missing or invalid counts', () => {
    expect(getNumberOfSeries({})).toBeUndefined()
    expect(
      getNumberOfSeries({ NumberOfStudyRelatedSeries: 'n/a' }),
    ).toBeUndefined()
    expect(
      getNumberOfSeries({ NumberOfStudyRelatedSeries: Number.NaN }),
    ).toBeUndefined()
    expect(
      getNumberOfSeries({ NumberOfStudyRelatedSeries: null }),
    ).toBeUndefined()
  })
})

describe('normalizeModalities', () => {
  it('returns an empty list for missing values', () => {
    expect(normalizeModalities(undefined)).toEqual([])
    expect(normalizeModalities(null)).toEqual([])
    expect(normalizeModalities('')).toEqual([])
    expect(normalizeModalities([])).toEqual([])
    expect(normalizeModalities(['', '  ', null])).toEqual([])
    expect(normalizeModalities(42)).toEqual([])
  })

  it('splits multi-valued strings', () => {
    expect(normalizeModalities('SM')).toEqual(['SM'])
    expect(normalizeModalities('SM\\SR')).toEqual(['SM', 'SR'])
    expect(normalizeModalities('SM, SEG')).toEqual(['SM', 'SEG'])
  })

  it('trims and de-duplicates array values in order', () => {
    expect(normalizeModalities([' SM', 'SR', 'SM ', 'ANN'])).toEqual([
      'SM',
      'SR',
      'ANN',
    ])
  })
})

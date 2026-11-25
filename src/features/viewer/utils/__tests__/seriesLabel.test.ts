import { formatSeriesLabel } from '../seriesLabel'

describe('formatSeriesLabel', () => {
  it('uses the series description', () => {
    expect(formatSeriesLabel('1.2.840.1234', 'H&E')).toBe('H&E')
  })

  it('falls back to a truncated UID', () => {
    expect(formatSeriesLabel('1.2.840.1234', undefined)).toBe(
      'Series 1.2.840....',
    )
    expect(formatSeriesLabel('1.2.840.1234', '')).toBe('Series 1.2.840....')
  })
})

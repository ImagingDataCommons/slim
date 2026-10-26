import { parseDicomDate, parseDicomDateParts } from '../datetime'

describe('parseDicomDateParts', () => {
  it('parses YYYYMMDD', () => {
    expect(parseDicomDateParts('20260912')).toEqual({
      year: 2026,
      month: 9,
      day: 12,
    })
  })

  it('parses legacy YYYY.MM.DD and dashed dates', () => {
    expect(parseDicomDateParts('2026.09.12')).toEqual({
      year: 2026,
      month: 9,
      day: 12,
    })
    expect(parseDicomDateParts('2026-09-12')).toEqual({
      year: 2026,
      month: 9,
      day: 12,
    })
  })

  it('trims surrounding whitespace', () => {
    expect(parseDicomDateParts(' 20260912 ')).not.toBeNull()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['too short', '2026091'],
    ['mixed separators', '2026.09-12'],
    ['a range', '20260901-20260912'],
    ['impossible day', '20260231'],
    ['month 13', '20261301'],
    ['month 0', '20260001'],
    ['letters', '2026O912'],
  ])('rejects %s', (_label, value) => {
    expect(parseDicomDateParts(value)).toBeNull()
  })
})

describe('parseDicomDate', () => {
  it('returns local midnight of the date', () => {
    expect(parseDicomDate('20260912')).toEqual(new Date(2026, 8, 12))
    expect(parseDicomDate('2026.09.12')).toEqual(new Date(2026, 8, 12))
  })

  it('returns null for invalid dates', () => {
    expect(parseDicomDate('20260231')).toBeNull()
    expect(parseDicomDate('2026.0912')).toBeNull()
    expect(parseDicomDate('')).toBeNull()
    expect(parseDicomDate(undefined)).toBeNull()
  })
})

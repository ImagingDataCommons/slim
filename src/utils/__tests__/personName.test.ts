import { formatRawPersonName, getAlphabeticName } from '../personName'

describe('getAlphabeticName', () => {
  it('reads strings, objects and arrays', () => {
    expect(getAlphabeticName('Doe^Jane')).toBe('Doe^Jane')
    expect(getAlphabeticName({ Alphabetic: 'Doe^Jane' })).toBe('Doe^Jane')
    expect(getAlphabeticName([{ Alphabetic: 'Doe^Jane' }])).toBe('Doe^Jane')
    expect(getAlphabeticName(['Doe^Jane', 'Other'])).toBe('Doe^Jane')
  })

  it('returns an empty string when there is no alphabetic group', () => {
    expect(getAlphabeticName(null)).toBe('')
    expect(getAlphabeticName(undefined)).toBe('')
    expect(getAlphabeticName({})).toBe('')
    expect(getAlphabeticName([])).toBe('')
  })
})

describe('formatRawPersonName', () => {
  it('replaces component separators and collapses whitespace', () => {
    expect(formatRawPersonName('Whitfield^Margaret^Ann')).toBe(
      'Whitfield Margaret Ann',
    )
    expect(formatRawPersonName({ Alphabetic: ' Doe^^Jane^ ' })).toBe('Doe Jane')
  })

  it('returns an empty string for missing names', () => {
    expect(formatRawPersonName(undefined)).toBe('')
  })
})

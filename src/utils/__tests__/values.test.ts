import { formatMultiValue } from '../values'

describe('formatMultiValue', () => {
  it('joins arrays', () => {
    expect(formatMultiValue(['1.0', '2.3'])).toBe('1.0, 2.3')
  })

  it('splits backslash-delimited strings', () => {
    expect(formatMultiValue('1.0\\ 2.3 ')).toBe('1.0, 2.3')
    expect(formatMultiValue('Scanner 4')).toBe('Scanner 4')
  })

  it('stringifies scalars and drops empty items', () => {
    expect(formatMultiValue(3)).toBe('3')
    expect(formatMultiValue(['', null, 'a'])).toBe('a')
  })

  it('returns an empty string for missing or object values', () => {
    expect(formatMultiValue(undefined)).toBe('')
    expect(formatMultiValue(null)).toBe('')
    expect(formatMultiValue({ a: 1 })).toBe('')
  })
})

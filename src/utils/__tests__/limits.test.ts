import { clampLimitValues, parseLimitInput } from '../limits'

describe('clampLimitValues', () => {
  it('keeps valid windows unchanged', () => {
    expect(clampLimitValues([10, 200], 0, 255)).toEqual([10, 200])
  })

  it('clamps both ends into the allowed range', () => {
    expect(clampLimitValues([-5, 300], 0, 255)).toEqual([0, 255])
  })

  it('pulls the edited lower limit down to the upper limit', () => {
    expect(clampLimitValues([150, 100], 0, 255, 'lower')).toEqual([100, 100])
  })

  it('pushes the edited upper limit up to the lower limit', () => {
    expect(clampLimitValues([150, 100], 0, 255, 'upper')).toEqual([150, 150])
  })

  it('handles non-finite values and swapped bounds', () => {
    expect(clampLimitValues([Number.NaN, Number.NaN], 0, 10)).toEqual([0, 10])
    expect(clampLimitValues([2, 8], 10, 0)).toEqual([2, 8])
  })

  it('supports fractional limits', () => {
    expect(clampLimitValues([0.25, 1.75], 0, 1)).toEqual([0.25, 1])
  })
})

describe('parseLimitInput', () => {
  it('parses floats by default and integers on request', () => {
    expect(parseLimitInput('0.5')).toBe(0.5)
    expect(parseLimitInput(' 12.9 ', true)).toBe(12)
  })

  it('rejects empty and non-numeric input', () => {
    expect(parseLimitInput('')).toBeUndefined()
    expect(parseLimitInput('abc')).toBeUndefined()
    expect(parseLimitInput('-')).toBeUndefined()
  })
})

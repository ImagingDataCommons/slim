import { clamp } from '../math'

describe('clamp', () => {
  it('returns values inside the range unchanged', () => {
    expect(clamp(0.4, 0, 1)).toBe(0.4)
    expect(clamp(0, 0, 1)).toBe(0)
    expect(clamp(1, 0, 1)).toBe(1)
  })

  it('limits values outside the range', () => {
    expect(clamp(-3, 0, 255)).toBe(0)
    expect(clamp(300, 0, 255)).toBe(255)
  })

  it('maps NaN to the lower bound', () => {
    expect(clamp(Number.NaN, 2, 5)).toBe(2)
  })

  it('handles infinite values', () => {
    expect(clamp(Number.POSITIVE_INFINITY, 0, 1)).toBe(1)
    expect(clamp(Number.NEGATIVE_INFINITY, 0, 1)).toBe(0)
  })
})

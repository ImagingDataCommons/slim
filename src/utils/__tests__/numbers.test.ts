import { describe, expect, it } from 'vitest'

import { toFiniteNumber } from '../numbers'

describe('toFiniteNumber', () => {
  it('accepts finite numbers and numeric strings', () => {
    expect(toFiniteNumber(3)).toBe(3)
    expect(toFiniteNumber('1.5')).toBe(1.5)
    expect(toFiniteNumber(' 2 ')).toBe(2)
  })

  it('rejects empty, non-numeric, and non-finite values', () => {
    expect(toFiniteNumber('')).toBeUndefined()
    expect(toFiniteNumber('  ')).toBeUndefined()
    expect(toFiniteNumber('x')).toBeUndefined()
    expect(toFiniteNumber(Number.NaN)).toBeUndefined()
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(toFiniteNumber(null)).toBeUndefined()
    expect(toFiniteNumber(undefined)).toBeUndefined()
  })
})

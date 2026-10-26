import { describe, expect, it } from 'vitest'

import { toggleSetValue } from '../set'

describe('toggleSetValue', () => {
  it('adds a missing value and removes a present one', () => {
    const input = new Set(['a'])
    expect([...toggleSetValue(input, 'b')]).toEqual(['a', 'b'])
    expect([...toggleSetValue(input, 'a')]).toEqual([])
    expect([...input]).toEqual(['a'])
  })
})

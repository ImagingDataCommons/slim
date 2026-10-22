import {
  reuseIdenticalArray,
  reuseIdenticalArrayRecord,
  reuseIdenticalRecord,
} from '../stableValues'

describe('reuseIdenticalArray', () => {
  const a = { id: 'a' }
  const b = { id: 'b' }

  it('keeps the previous array for the same items in the same order', () => {
    const previous = [a, b]
    expect(reuseIdenticalArray(previous, [a, b])).toBe(previous)
  })

  it('takes the next array when items or order differ', () => {
    const next = [b, a]
    expect(reuseIdenticalArray([a, b], next)).toBe(next)
    const longer = [a, b, a]
    expect(reuseIdenticalArray([a, b], longer)).toBe(longer)
  })
})

describe('reuseIdenticalRecord', () => {
  const style = { opacity: 1 }

  it('keeps the previous record for identical values', () => {
    const previous = { x: style }
    expect(reuseIdenticalRecord(previous, { x: style })).toBe(previous)
  })

  it('takes the next record for new values or keys', () => {
    const changed = { x: { opacity: 1 } }
    expect(reuseIdenticalRecord({ x: style }, changed)).toBe(changed)
    const renamed = { y: style }
    expect(reuseIdenticalRecord({ x: style }, renamed)).toBe(renamed)
  })
})

describe('reuseIdenticalArrayRecord', () => {
  const item = { id: 'meta' }

  it('compares the arrays item by item', () => {
    const previous = { x: [item] }
    expect(reuseIdenticalArrayRecord(previous, { x: [item] })).toBe(previous)
  })

  it('takes the next record when an array changed', () => {
    const next = { x: [item, item] }
    expect(reuseIdenticalArrayRecord({ x: [item] }, next)).toBe(next)
  })
})

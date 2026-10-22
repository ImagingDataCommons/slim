import { reuseEqualStyles } from '../stableStyles'

describe('reuseEqualStyles', () => {
  it('returns the previous map when every style is equal', () => {
    const previous = { a: { opacity: 1, color: [255, 0, 0] } }
    const next = { a: { opacity: 1, color: [255, 0, 0] } }
    expect(reuseEqualStyles(previous, next)).toBe(previous)
  })

  it('keeps unchanged entries and takes changed ones', () => {
    const unchanged = { opacity: 1, color: [255, 0, 0] }
    const previous = { a: unchanged, b: { opacity: 1, color: [0, 0, 0] } }
    const changed = { opacity: 0.5, color: [0, 0, 0] }
    const result = reuseEqualStyles(previous, {
      a: { opacity: 1, color: [255, 0, 0] },
      b: changed,
    })
    expect(result).not.toBe(previous)
    expect(result.a).toBe(unchanged)
    expect(result.b).toBe(changed)
  })

  it('returns a new map when entries are added or removed', () => {
    const style = { opacity: 1 }
    const previous = { a: style }
    const added = reuseEqualStyles(previous, { a: { opacity: 1 }, b: style })
    expect(added).not.toBe(previous)
    expect(added.a).toBe(style)
    const removed = reuseEqualStyles({ a: style, b: style }, { a: style })
    expect(Object.keys(removed)).toEqual(['a'])
  })

  it('does not reuse inherited properties', () => {
    const result = reuseEqualStyles({}, { toString: { opacity: 1 } })
    expect(result).toEqual({ toString: { opacity: 1 } })
  })
})

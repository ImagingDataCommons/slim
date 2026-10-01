import { applyVisibilityChanges, removeHiddenUids } from '../visibilityChanges'

describe('applyVisibilityChanges', () => {
  it('adds shown and removes hidden uids without mutating the input', () => {
    const visible = new Set(['a', 'b'])
    const next = applyVisibilityChanges(visible, [
      { uid: 'c', isVisible: true },
      { uid: 'a', isVisible: false },
    ])
    expect([...next].sort()).toEqual(['b', 'c'])
    expect([...visible].sort()).toEqual(['a', 'b'])
  })

  it('applies changes of the same uid in order', () => {
    const next = applyVisibilityChanges(new Set(), [
      { uid: 'a', isVisible: true },
      { uid: 'a', isVisible: false },
    ])
    expect(next.size).toBe(0)
  })

  it('returns an equal copy without changes', () => {
    const visible = new Set(['a'])
    const next = applyVisibilityChanges(visible, [])
    expect(next).not.toBe(visible)
    expect([...next]).toEqual(['a'])
  })
})

describe('removeHiddenUids', () => {
  it('only removes uids that are being hidden', () => {
    const selected = new Set(['a', 'b'])
    const next = removeHiddenUids(selected, [
      { uid: 'a', isVisible: false },
      { uid: 'c', isVisible: true },
    ])
    expect([...next]).toEqual(['b'])
  })
})

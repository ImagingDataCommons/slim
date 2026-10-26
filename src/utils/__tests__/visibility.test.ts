import {
  computeBulkVisibility,
  countVisible,
  getToggleTarget,
  getVisibilityState,
} from '../visibility'

describe('computeBulkVisibility', () => {
  const all = ['a', 'b', 'c']

  it('shows only hidden uids', () => {
    expect(computeBulkVisibility(all, new Set(['b']), true)).toEqual([
      { uid: 'a', isVisible: true },
      { uid: 'c', isVisible: true },
    ])
  })

  it('hides only visible uids of the list', () => {
    expect(computeBulkVisibility(all, ['b', 'c', 'other'], false)).toEqual([
      { uid: 'b', isVisible: false },
      { uid: 'c', isVisible: false },
    ])
  })

  it('returns no changes when already in the target state', () => {
    expect(computeBulkVisibility(all, all, true)).toEqual([])
    expect(computeBulkVisibility(all, [], false)).toEqual([])
    expect(computeBulkVisibility([], ['a'], true)).toEqual([])
  })

  it('ignores duplicate uids', () => {
    expect(computeBulkVisibility(['a', 'a'], [], true)).toEqual([
      { uid: 'a', isVisible: true },
    ])
  })
})

describe('getVisibilityState', () => {
  it('reports all, some or none', () => {
    expect(getVisibilityState(['a', 'b'], ['a', 'b'])).toBe('all')
    expect(getVisibilityState(['a', 'b'], new Set(['a']))).toBe('some')
    expect(getVisibilityState(['a', 'b'], ['c'])).toBe('none')
    expect(getVisibilityState([], ['a'])).toBe('none')
  })
})

describe('countVisible', () => {
  it('counts listed visible uids', () => {
    expect(countVisible(['a', 'b', 'c'], ['a', 'c', 'x'])).toBe(2)
  })
})

describe('getToggleTarget', () => {
  it('shows everything unless all are visible', () => {
    expect(getToggleTarget('all')).toBe(false)
    expect(getToggleTarget('some')).toBe(true)
    expect(getToggleTarget('none')).toBe(true)
  })
})

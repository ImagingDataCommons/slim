import { sortByIdentifier } from '../opticalPathOrder'

describe('sortByIdentifier', () => {
  it('sorts by identifier without mutating the input', () => {
    const items = [
      { identifier: 'c' },
      { identifier: 'a' },
      { identifier: 'b' },
    ]
    expect(sortByIdentifier(items).map((item) => item.identifier)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(items.map((item) => item.identifier)).toEqual(['c', 'a', 'b'])
  })

  it('keeps equal identifiers in input order', () => {
    const first = { identifier: 'a', n: 1 }
    const second = { identifier: 'a', n: 2 }
    expect(sortByIdentifier([first, second])).toEqual([first, second])
  })
})

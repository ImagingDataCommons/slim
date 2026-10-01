import {
  ALL_SERIES,
  buildSeriesOptions,
  groupBySeries,
  itemsForSeries,
} from '../groupBySeries'

interface Item {
  uid: string
  series: string
}

const items: Item[] = [
  { uid: 'a', series: 's2' },
  { uid: 'b', series: 's1' },
  { uid: 'c', series: 's2' },
]

describe('groupBySeries', () => {
  it('groups items in first-seen series order', () => {
    const groups = groupBySeries(items, (item) => item.series)
    expect(Array.from(groups.keys())).toEqual(['s2', 's1'])
    expect(groups.get('s2')?.map((item) => item.uid)).toEqual(['a', 'c'])
  })

  it('returns an empty map for no items', () => {
    expect(groupBySeries([], () => 'x').size).toBe(0)
  })
})

describe('itemsForSeries', () => {
  const groups = groupBySeries(items, (item) => item.series)

  it('returns every item for the all option or no selection', () => {
    expect(itemsForSeries(items, groups, ALL_SERIES)).toBe(items)
    expect(itemsForSeries(items, groups, undefined)).toBe(items)
  })

  it('returns the selected series, or nothing for an unknown one', () => {
    expect(itemsForSeries(items, groups, 's1').map((i) => i.uid)).toEqual(['b'])
    expect(itemsForSeries(items, groups, 'nope')).toEqual([])
  })
})

describe('buildSeriesOptions', () => {
  it('lists an all entry and one labeled entry per series', () => {
    const groups = groupBySeries(items, (item) => item.series)
    expect(
      buildSeriesOptions({
        groups,
        allLabel: 'All Series (3 segments)',
        unit: 'segments',
        describeSeries: (uid) => `Series ${uid}`,
      }),
    ).toEqual([
      { value: 'all', label: 'All Series (3 segments)' },
      { value: 's2', label: 'Series s2 (2 segments)' },
      { value: 's1', label: 'Series s1 (1 segments)' },
    ])
  })
})

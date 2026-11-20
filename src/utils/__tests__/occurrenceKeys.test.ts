import { withOccurrenceKeys } from '../occurrenceKeys'

describe('withOccurrenceKeys', () => {
  it('numbers repeated bases in order', () => {
    const entries = withOccurrenceKeys(
      ['Staining', 'Anatomy', 'Staining'],
      (label) => label,
    )
    expect(entries.map((entry) => entry.key)).toEqual([
      'Staining#0',
      'Anatomy#0',
      'Staining#1',
    ])
  })

  it('keeps the original items', () => {
    const items = [{ label: 'a' }, { label: 'b' }]
    const entries = withOccurrenceKeys(items, (item) => item.label)
    expect(entries.map((entry) => entry.item)).toEqual(items)
  })

  it('returns an empty list for no items', () => {
    expect(withOccurrenceKeys([], String)).toEqual([])
  })
})

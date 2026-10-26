import { toKeyValueItems } from '../keyValue'

describe('toKeyValueItems', () => {
  it('renames name to label and keeps order', () => {
    expect(
      toKeyValueItems([
        { name: 'Graphic type', value: 'POLYGON' },
        { name: 'Count', value: 3 },
      ]),
    ).toEqual([
      { label: 'Graphic type', value: 'POLYGON' },
      { label: 'Count', value: 3 },
    ])
  })

  it('returns an empty list for no attributes', () => {
    expect(toKeyValueItems([])).toEqual([])
  })
})

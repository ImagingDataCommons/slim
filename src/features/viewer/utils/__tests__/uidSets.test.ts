import { withItem, withItems, withoutItem } from '../uidSets'

describe('uid set copies', () => {
  it('adds and removes items without touching the original', () => {
    const original = new Set(['a'])

    expect([...withItem(original, 'b')]).toEqual(['a', 'b'])
    expect([...withoutItem(original, 'a')]).toEqual([])
    expect([...withItems(original, ['b', 'c', 'a'])]).toEqual(['a', 'b', 'c'])
    expect([...original]).toEqual(['a'])
  })
})

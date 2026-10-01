import { applyEach } from '../applyEach'

describe('applyEach', () => {
  it('passes every result to onSettled', () => {
    const onSettled = vi.fn()

    applyEach([1, 2, 3], (n) => n * 2, onSettled)

    expect(onSettled).toHaveBeenCalledWith([2, 4, 6])
  })

  it('settles with an empty list when there are no items', () => {
    const onSettled = vi.fn()

    applyEach([], (n: number) => n, onSettled)

    expect(onSettled).toHaveBeenCalledWith([])
  })

  it('settles with the results before a failure, then rethrows', () => {
    const onSettled = vi.fn()
    const error = new Error('viewer not ready')

    expect(() =>
      applyEach(
        ['a', 'b', 'c'],
        (item) => {
          if (item === 'b') throw error
          return item.toUpperCase()
        },
        onSettled,
      ),
    ).toThrow(error)
    expect(onSettled).toHaveBeenCalledWith(['A'])
  })
})

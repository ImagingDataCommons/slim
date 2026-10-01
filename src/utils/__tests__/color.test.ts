import { toRGB, withChannel } from '../color'

describe('toRGB', () => {
  it('keeps the first three channels', () => {
    expect(toRGB([10, 20, 30])).toEqual([10, 20, 30])
    expect(toRGB([10, 20, 30, 0.5])).toEqual([10, 20, 30])
  })

  it('rounds and clamps channels to 0-255', () => {
    expect(toRGB([-4, 127.6, 400])).toEqual([0, 128, 255])
  })

  it('treats non-finite channels as 0', () => {
    expect(toRGB([Number.NaN, 5, Number.POSITIVE_INFINITY])).toEqual([0, 5, 0])
  })

  it('returns the fallback for missing or short colors', () => {
    expect(toRGB(undefined, [255, 255, 0])).toEqual([255, 255, 0])
    expect(toRGB(null, [1, 2, 3])).toEqual([1, 2, 3])
    expect(toRGB([1, 2], [9, 9, 9])).toEqual([9, 9, 9])
  })

  it('returns undefined without a fallback', () => {
    expect(toRGB(undefined)).toBeUndefined()
    expect(toRGB([])).toBeUndefined()
  })
})

describe('withChannel', () => {
  it('replaces one channel without mutating the input', () => {
    const color: [number, number, number] = [1, 2, 3]
    expect(withChannel(color, 1, 200)).toEqual([1, 200, 3])
    expect(color).toEqual([1, 2, 3])
  })

  it('clamps the new channel value', () => {
    expect(withChannel([0, 0, 0], 0, 999)).toEqual([255, 0, 0])
    expect(withChannel([0, 0, 0], 2, -1)).toEqual([0, 0, 0])
  })
})

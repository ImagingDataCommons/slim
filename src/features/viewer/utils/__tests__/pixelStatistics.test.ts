import {
  computePixelRange,
  mergePixelStatistics,
  type PixelStatistics,
  recordFirstFrameStatistics,
} from '../pixelStatistics'

describe('recordFirstFrameStatistics', () => {
  it('records the first frame of each optical path only', () => {
    const statistics = new Map<string, PixelStatistics>()
    recordFirstFrameStatistics(statistics, '1', new Uint8Array([4, 9]))
    recordFirstFrameStatistics(statistics, '1', new Uint8Array([0, 255]))
    recordFirstFrameStatistics(statistics, '2', new Uint8Array([7]))

    expect(statistics.get('1')).toEqual({ min: 4, max: 9, numFramesSampled: 1 })
    expect(statistics.get('2')).toEqual({ min: 7, max: 7, numFramesSampled: 1 })
  })

  it('ignores missing and empty pixel data', () => {
    const statistics = new Map<string, PixelStatistics>()
    recordFirstFrameStatistics(statistics, '1', null)
    recordFirstFrameStatistics(statistics, '1', undefined)
    recordFirstFrameStatistics(statistics, '1', new Uint8Array(0))

    expect(statistics.size).toBe(0)
  })
})

describe('computePixelRange', () => {
  it('returns undefined for an empty array', () => {
    expect(computePixelRange(new Uint16Array(0))).toBeUndefined()
  })

  it('finds min and max of typed arrays', () => {
    expect(computePixelRange(new Uint8Array([5, 2, 9, 3]))).toEqual({
      min: 2,
      max: 9,
    })
    expect(computePixelRange(new Float32Array([-1.5, 0, 2.5]))).toEqual({
      min: -1.5,
      max: 2.5,
    })
  })

  it('handles frames larger than the spread argument limit', () => {
    const pixels = new Uint16Array(2 ** 18)
    pixels[3] = 7
    pixels[2 ** 18 - 1] = 65535
    expect(computePixelRange(pixels)).toEqual({ min: 0, max: 65535 })
  })
})

describe('mergePixelStatistics', () => {
  it('starts sampling with the first range', () => {
    expect(mergePixelStatistics(undefined, { min: 3, max: 8 })).toEqual({
      min: 3,
      max: 8,
      numFramesSampled: 1,
    })
  })

  it('widens the range and counts frames', () => {
    const previous = { min: 3, max: 8, numFramesSampled: 2 }
    expect(mergePixelStatistics(previous, { min: 1, max: 6 })).toEqual({
      min: 1,
      max: 8,
      numFramesSampled: 3,
    })
    expect(previous).toEqual({ min: 3, max: 8, numFramesSampled: 2 })
  })
})

import {
  maxValueForBitsAllocated,
  windowSliderBounds,
} from '../opticalPathLimits'

describe('maxValueForBitsAllocated', () => {
  it('defaults to 8-bit when BitsAllocated is missing', () => {
    expect(maxValueForBitsAllocated(undefined)).toBe(255)
  })

  it('uses the stated bit depth', () => {
    expect(maxValueForBitsAllocated(16)).toBe(65535)
  })
})

describe('windowSliderBounds', () => {
  it('uses the bit depth until a frame was sampled', () => {
    expect(
      windowSliderBounds({
        bitsMax: 65535,
        pixelRange: undefined,
        limitValues: [2, 33],
      }),
    ).toEqual({ min: 0, max: 65535, step: 1 })
  })

  it('fits the observed range so a narrow window is not pinned at zero', () => {
    const bounds = windowSliderBounds({
      bitsMax: 65535,
      pixelRange: { min: 0, max: 48 },
      limitValues: [2.03, 32.56],
    })
    expect(bounds.min).toBe(0)
    expect(bounds.max).toBe(48)
    expect(bounds.step).toBeCloseTo(0.048)
  })

  it('leaves room above a window wider than the sampled frame', () => {
    expect(
      windowSliderBounds({
        bitsMax: 65535,
        pixelRange: { min: 10, max: 900 },
        limitValues: [5, 4000],
      }),
    ).toEqual({ min: 0, max: 5000, step: 1 })
  })

  it('never returns an empty range', () => {
    const bounds = windowSliderBounds({
      bitsMax: 255,
      pixelRange: { min: 0, max: 0 },
      limitValues: [0, 0],
    })
    expect(bounds.max).toBeGreaterThan(bounds.min)
  })
})

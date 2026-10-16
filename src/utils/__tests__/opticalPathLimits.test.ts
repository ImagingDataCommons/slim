import { maxValueForBitsAllocated } from '../opticalPathLimits'

describe('maxValueForBitsAllocated', () => {
  it('defaults to 8-bit when BitsAllocated is missing', () => {
    expect(maxValueForBitsAllocated(undefined)).toBe(255)
  })

  it('uses the stated bit depth', () => {
    expect(maxValueForBitsAllocated(16)).toBe(65535)
  })
})

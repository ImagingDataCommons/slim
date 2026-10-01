import dcmjs from 'dcmjs'

import { getSegmentationType, getSegmentColor } from '../segmentColors'

describe('getSegmentColor', () => {
  const segmentSequence = [
    { SegmentNumber: 1, RecommendedDisplayCIELabValue: [50, 10, -20] },
    { SegmentNumber: 2 },
    { SegmentNumber: 3, RecommendedDisplayCIELabValue: [1, 2] },
    { SegmentNumber: 4, RecommendedDisplayCIELabValue: ['a', 'b', 'c'] },
  ]

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('converts the recommended CIELab value to 8-bit RGB', () => {
    const color = getSegmentColor({ segmentSequence, segmentNumber: 1 })
    expect(color).toHaveLength(3)
    for (const channel of color ?? []) {
      expect(Number.isInteger(channel)).toBe(true)
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(255)
    }
  })

  it('scales and clamps the converted channels', () => {
    jest.spyOn(dcmjs.data.Colors, 'dicomlab2RGB').mockReturnValue([1, 0.5, 1.2])
    expect(getSegmentColor({ segmentSequence, segmentNumber: 1 })).toEqual([
      255, 128, 255,
    ])
  })

  it('returns null without a usable color', () => {
    expect(getSegmentColor({ segmentSequence, segmentNumber: 2 })).toBeNull()
    expect(getSegmentColor({ segmentSequence, segmentNumber: 3 })).toBeNull()
    expect(getSegmentColor({ segmentSequence, segmentNumber: 4 })).toBeNull()
    expect(getSegmentColor({ segmentSequence, segmentNumber: 9 })).toBeNull()
    expect(
      getSegmentColor({ segmentSequence: undefined, segmentNumber: 1 }),
    ).toBeNull()
  })

  it('returns null when the conversion throws', () => {
    jest.spyOn(dcmjs.data.Colors, 'dicomlab2RGB').mockImplementation(() => {
      throw new Error('bad lab')
    })
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(getSegmentColor({ segmentSequence, segmentNumber: 1 })).toBeNull()
  })
})

describe('getSegmentationType', () => {
  it('returns the SegmentationType when present', () => {
    expect(getSegmentationType({ SegmentationType: 'FRACTIONAL' })).toBe(
      'FRACTIONAL',
    )
  })

  it('defaults to BINARY', () => {
    expect(getSegmentationType({})).toBe('BINARY')
    expect(getSegmentationType({ SegmentationType: null })).toBe('BINARY')
    expect(getSegmentationType(undefined)).toBe('BINARY')
    expect(getSegmentationType(null)).toBe('BINARY')
  })
})

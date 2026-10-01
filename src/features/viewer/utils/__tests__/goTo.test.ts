import {
  choosePyramidLevel,
  EMPTY_GO_TO_INPUT,
  validateGoToInput,
} from '../goTo'

const ranges = { x: [0, 20], y: [10, 30] } as const

describe('validateGoToInput', () => {
  it('reports empty fields as invalid without a target', () => {
    const result = validateGoToInput(EMPTY_GO_TO_INPUT, ranges)
    expect(result.target).toBeUndefined()
    expect(result.fields.x).toEqual({ isEmpty: true, isValid: false })
    expect(result.fields.magnification).toEqual({
      isEmpty: true,
      isValid: false,
    })
  })

  it('returns the target when every field is in range (inclusive)', () => {
    const result = validateGoToInput(
      { x: '0', y: '30', magnification: '40' },
      ranges,
    )
    expect(result.target).toEqual({ x: 0, y: 30, magnification: 40 })
  })

  it('flags out-of-range and non-numeric values', () => {
    const result = validateGoToInput(
      { x: '21', y: 'abc', magnification: '-1' },
      ranges,
    )
    expect(result.target).toBeUndefined()
    expect(result.fields.x).toEqual({ isEmpty: false, isValid: false })
    expect(result.fields.y).toEqual({ isEmpty: false, isValid: false })
    expect(result.fields.magnification).toEqual({
      isEmpty: false,
      isValid: false,
    })
  })

  it('accepts zero magnification like the original range check', () => {
    const result = validateGoToInput(
      { x: '1', y: '11', magnification: '0' },
      ranges,
    )
    expect(result.fields.magnification.isValid).toBe(true)
  })
})

describe('choosePyramidLevel', () => {
  const spacings = [0.00025, 0.0005, 0.001, 0.002, 0.004]

  it('picks the level closest to 10 µm / magnification', () => {
    expect(choosePyramidLevel(40, spacings)).toBe(0)
    expect(choosePyramidLevel(20, spacings)).toBe(1)
    expect(choosePyramidLevel(10, spacings)).toBe(2)
    expect(choosePyramidLevel(2.5, spacings)).toBe(4)
  })

  it('keeps the first level on ties and for empty pyramids', () => {
    expect(choosePyramidLevel(10, [0.001, 0.001])).toBe(0)
    expect(choosePyramidLevel(10, [])).toBe(0)
  })

  it('falls back to the first level for zero magnification', () => {
    expect(choosePyramidLevel(0, spacings)).toBe(0)
  })
})

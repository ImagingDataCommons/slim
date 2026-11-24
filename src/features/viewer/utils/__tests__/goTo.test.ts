import { EMPTY_GO_TO_INPUT, goToResolution, validateGoToInput } from '../goTo'

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

  it('rejects zero magnification', () => {
    const result = validateGoToInput(
      { x: '1', y: '11', magnification: '0' },
      ranges,
    )
    expect(result.fields.magnification.isValid).toBe(false)
    expect(result.target).toBeUndefined()
  })
})

describe('goToResolution', () => {
  it('uses 10 µm per screen pixel at 1×, like the magnification readout', () => {
    expect(goToResolution(1)).toBeCloseTo(0.01, 12)
    expect(goToResolution(40)).toBeCloseTo(0.00025, 12)
  })
})

import { areLayerItemPropsEqual, areStylesEqual } from '../styleEquality'

describe('areStylesEqual', () => {
  it('compares array values element-wise', () => {
    expect(
      areStylesEqual(
        { opacity: 1, color: [1, 2, 3] },
        { opacity: 1, color: [1, 2, 3] },
      ),
    ).toBe(true)
    expect(
      areStylesEqual(
        { opacity: 1, color: [1, 2, 3] },
        { opacity: 1, color: [1, 2, 4] },
      ),
    ).toBe(false)
  })

  it('compares other values by identity', () => {
    const palette = { data: [[0, 0, 0]] }
    expect(
      areStylesEqual(
        { opacity: 1, paletteColorLookupTable: palette },
        { opacity: 1, paletteColorLookupTable: palette },
      ),
    ).toBe(true)
    expect(
      areStylesEqual(
        { opacity: 1, paletteColorLookupTable: palette },
        { opacity: 1, paletteColorLookupTable: { data: [[0, 0, 0]] } },
      ),
    ).toBe(false)
  })

  it('detects added, removed and undefined keys', () => {
    expect(areStylesEqual({ opacity: 1 }, { opacity: 1, color: [1] })).toBe(
      false,
    )
    expect(
      areStylesEqual({ opacity: 1, color: undefined }, { opacity: 1, fill: 1 }),
    ).toBe(false)
  })

  it('handles undefined styles', () => {
    expect(areStylesEqual(undefined, undefined)).toBe(true)
    expect(areStylesEqual({ opacity: 1 }, undefined)).toBe(false)
  })
})

describe('areLayerItemPropsEqual', () => {
  const onChange = (): void => undefined

  it('ignores rebuilt but equal default styles', () => {
    expect(
      areLayerItemPropsEqual(
        { defaultStyle: { opacity: 0.5 }, isVisible: true, onChange },
        { defaultStyle: { opacity: 0.5 }, isVisible: true, onChange },
      ),
    ).toBe(true)
  })

  it('detects changed props and styles', () => {
    expect(
      areLayerItemPropsEqual(
        { defaultStyle: { opacity: 0.5 }, isVisible: true },
        { defaultStyle: { opacity: 0.5 }, isVisible: false },
      ),
    ).toBe(false)
    expect(
      areLayerItemPropsEqual(
        { defaultStyle: { opacity: 0.5 } },
        { defaultStyle: { opacity: 0.6 } },
      ),
    ).toBe(false)
    expect(
      areLayerItemPropsEqual(
        { defaultStyle: { opacity: 0.5 }, onChange },
        { defaultStyle: { opacity: 0.5 }, onChange: () => undefined },
      ),
    ).toBe(false)
  })
})

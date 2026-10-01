import { getSegmentSwatchBackground } from '../segmentSwatch'

describe('getSegmentSwatchBackground', () => {
  it('uses the flat color for binary segments', () => {
    expect(
      getSegmentSwatchBackground({
        isFractional: false,
        color: [255, 255, 0],
        palette: { data: [[0, 0, 0]] },
      }),
    ).toBe('#ffff00')
  })

  it('uses the palette gradient for fractional segments', () => {
    expect(
      getSegmentSwatchBackground({
        isFractional: true,
        color: [255, 255, 0],
        palette: {
          data: [
            [0, 0, 0],
            [255, 0, 0],
          ],
        },
      }),
    ).toBe('linear-gradient(90deg, #000000 0%, #ff0000 100%)')
  })

  it('is undefined for fractional segments without a usable palette', () => {
    expect(
      getSegmentSwatchBackground({ isFractional: true, color: [1, 2, 3] }),
    ).toBeUndefined()
    expect(
      getSegmentSwatchBackground({
        isFractional: true,
        color: [1, 2, 3],
        palette: { data: [] },
      }),
    ).toBeUndefined()
  })
})

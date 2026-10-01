import { lutToCssGradient } from '../lutGradient'

describe('lutToCssGradient', () => {
  it('renders every entry of a short LUT', () => {
    expect(
      lutToCssGradient([
        [0, 0, 0],
        [255, 0, 0],
        [255, 255, 255],
      ]),
    ).toBe('linear-gradient(90deg, #000000 0%, #ff0000 50%, #ffffff 100%)')
  })

  it('accepts a palette object and a custom angle', () => {
    expect(
      lutToCssGradient(
        {
          data: [
            [0, 0, 255],
            [0, 255, 0],
          ],
        },
        135,
      ),
    ).toBe('linear-gradient(135deg, #0000ff 0%, #00ff00 100%)')
  })

  it('samples long LUTs down to maxStops including both ends', () => {
    const data = Array.from({ length: 256 }, (_, index) => [index, 0, 0])
    const gradient = lutToCssGradient(data, 90, 5)
    expect(gradient).toBe(
      'linear-gradient(90deg, #000000 0%, #400000 25%, #800000 50%, #bf0000 75%, #ff0000 100%)',
    )
  })

  it('handles single-entry and empty LUTs', () => {
    expect(lutToCssGradient([[1, 2, 3]])).toBe(
      'linear-gradient(90deg, #010203, #010203)',
    )
    expect(lutToCssGradient([])).toBe('')
  })
})

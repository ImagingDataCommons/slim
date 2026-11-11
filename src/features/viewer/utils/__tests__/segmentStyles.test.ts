import {
  binarySegmentColors,
  recommendedBinarySegmentColors,
  segmentPanelStyles,
} from '../segmentStyles'

const WHITE_LAB = [65535, 32896, 32896]

describe('recommendedBinarySegmentColors', () => {
  it('converts the recommended color of BINARY segments only', () => {
    const colors = recommendedBinarySegmentColors(
      [
        { uid: 'binary', number: 1 },
        { uid: 'no-color', number: 2 },
        { uid: 'fractional', number: 1 },
      ],
      {
        binary: [
          {
            SegmentSequence: [
              { SegmentNumber: 1, RecommendedDisplayCIELabValue: WHITE_LAB },
            ],
          },
        ],
        'no-color': [{ SegmentationType: 'BINARY', SegmentSequence: [] }],
        fractional: [{ SegmentationType: 'FRACTIONAL' }],
      },
    )

    expect(Object.keys(colors)).toEqual(['binary', 'no-color'])
    expect(colors.binary).toHaveLength(3)
    for (const channel of colors.binary ?? []) {
      expect(channel).toBeGreaterThanOrEqual(254)
    }
    expect(colors['no-color']).toBeUndefined()
  })
})

describe('binarySegmentColors', () => {
  it('prefers the customized color', () => {
    expect(
      binarySegmentColors(
        { a: [1, 1, 1], b: [2, 2, 2], c: undefined },
        { b: [9, 9, 9], other: [0, 0, 0] },
      ),
    ).toEqual({ a: [1, 1, 1], b: [9, 9, 9], c: undefined })
  })
})

describe('segmentPanelStyles', () => {
  it('shows the color of BINARY segments and the palette of the others', () => {
    const paletteColorLookupTable = { data: [[1, 2, 3]] }
    const styles = segmentPanelStyles(
      [
        { uid: 'binary', number: 1 },
        { uid: 'labelmap', number: 1 },
      ],
      {
        binary: { opacity: 0.5 },
        labelmap: {
          opacity: 0.8,
          paletteColorLookupTable,
        },
      },
      { binary: [9, 9, 9] },
    )

    expect(styles).toEqual({
      binary: { opacity: 0.5, color: [9, 9, 9] },
      labelmap: { opacity: 0.8, color: undefined, paletteColorLookupTable },
    })
  })
})

import {
  binarySegmentColors,
  flatPaletteColor,
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

  it('shows the drawn color of segments with a two-entry palette (LABELMAP)', () => {
    const flat = {
      data: [
        [0, 0, 0],
        [0, 255, 0],
      ],
    }
    const gradient = {
      data: [
        [0, 0, 0],
        [128, 0, 0],
        [255, 0, 0],
      ],
    }
    const styles = segmentPanelStyles(
      [
        { uid: 'labelmap', number: 2 },
        { uid: 'fractional', number: 1 },
      ],
      {
        labelmap: { opacity: 0.75, paletteColorLookupTable: flat },
        fractional: { opacity: 0.75, paletteColorLookupTable: gradient },
      },
      {},
    )

    expect(styles.labelmap.color).toEqual([0, 255, 0])
    expect(styles.fractional.color).toBeUndefined()
  })
})

describe('flatPaletteColor', () => {
  it('is the segment entry of a two-entry palette only', () => {
    expect(
      flatPaletteColor({
        data: [
          [0, 0, 0],
          [1, 2, 3],
        ],
      }),
    ).toEqual([1, 2, 3])
    expect(flatPaletteColor({ data: [[1, 2, 3]] })).toBeUndefined()
    /** skipcq: JS-W1042 - the palette argument is required */
    expect(flatPaletteColor(undefined)).toBeUndefined()
  })
})

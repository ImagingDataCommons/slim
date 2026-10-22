import {
  buildSlideAffine,
  imageToSlideCoordinates,
  slideAffineFromImages,
} from '../slideCoordinates'

function image({
  columns,
  spacing,
  orientation = [0, -1, 0, -1, 0, 0],
  offset = [10, 20],
}: {
  columns: number
  spacing: number
  orientation?: Array<number | string>
  offset?: Array<number | string>
}): Record<string, unknown> & { TotalPixelMatrixColumns: number } {
  return {
    TotalPixelMatrixColumns: columns,
    TotalPixelMatrixRows: columns,
    ImageOrientationSlide: orientation,
    TotalPixelMatrixOriginSequence: [
      {
        XOffsetInSlideCoordinateSystem: offset[0],
        YOffsetInSlideCoordinateSystem: offset[1],
      },
    ],
    SharedFunctionalGroupsSequence: [
      { PixelMeasuresSequence: [{ PixelSpacing: [spacing, spacing] }] },
    ],
  }
}

describe('buildSlideAffine', () => {
  it('applies the half-pixel correction', () => {
    const affine = buildSlideAffine({
      offset: [10, 20],
      orientation: [1, 0, 0, 0, 1, 0],
      spacing: [0.001, 0.002],
    })
    expect(affine[0]).toEqual([0.002, 0, 10 - 0.001])
    expect(affine[1]).toEqual([0, 0.001, 20 - 0.0005])
  })
})

describe('imageToSlideCoordinates', () => {
  it('matches DMV for the common rotated orientation', () => {
    const affine = buildSlideAffine({
      offset: [10, 20],
      orientation: [0, -1, 0, -1, 0, 0],
      spacing: [0.001, 0.001],
    })
    const [x, y] = imageToSlideCoordinates([100, -51], affine)
    expect(x).toBeCloseTo(9.9505, 10)
    expect(y).toBeCloseTo(19.9005, 10)
  })

  it('maps the origin pixel center onto the slide offset', () => {
    const affine = buildSlideAffine({
      offset: [5, 7],
      orientation: [1, 0, 0, 0, 1, 0],
      spacing: [0.0005, 0.0005],
    })
    const [x, y] = imageToSlideCoordinates([0.5, -1.5], affine)
    expect(x).toBeCloseTo(5, 10)
    expect(y).toBeCloseTo(7, 10)
  })
})

describe('slideAffineFromImages', () => {
  it('uses the largest (base) level', () => {
    const affine = slideAffineFromImages([
      image({ columns: 1000, spacing: 0.004 }),
      image({ columns: 16000, spacing: 0.00025 }),
    ])
    expect(affine?.[0][1]).toBeCloseTo(-0.00025, 12)
  })

  it('accepts string-encoded DICOM numbers', () => {
    const affine = slideAffineFromImages([
      image({
        columns: 10,
        spacing: 0.001,
        orientation: ['1', '0', '0', '0', '1', '0'],
        offset: ['1.5', '2.5'],
      }),
    ])
    expect(affine).toBeDefined()
    expect(affine?.[0][2]).toBeCloseTo(1.4995, 10)
  })

  it('returns undefined when geometry is incomplete', () => {
    expect(slideAffineFromImages([])).toBeUndefined()
    expect(
      slideAffineFromImages([
        image({ columns: 10, spacing: 0.001, orientation: [1, 0, 0] }),
      ]),
    ).toBeUndefined()
    expect(
      slideAffineFromImages([{ TotalPixelMatrixColumns: 10 }]),
    ).toBeUndefined()
  })
})

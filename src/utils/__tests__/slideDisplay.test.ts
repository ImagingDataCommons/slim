import {
  formatNominalMagnification,
  getIlluminationType,
  getMagnification,
  getSlideDisplayId,
  getSlideStainInfo,
  minimumPixelSpacing,
  readObjectiveLensPower,
  readPixelSpacing,
} from '../slideDisplay'

function level(spacing: Array<number | string>): {
  SharedFunctionalGroupsSequence: unknown
} {
  return {
    SharedFunctionalGroupsSequence: [
      { PixelMeasuresSequence: [{ PixelSpacing: spacing }] },
    ],
  }
}

describe('readPixelSpacing', () => {
  it('reads numeric and string spacing', () => {
    expect(readPixelSpacing(level([0.00025, 0.00025]))).toEqual([
      0.00025, 0.00025,
    ])
    expect(readPixelSpacing(level(['0.0005', '0.0004']))).toEqual([
      0.0005, 0.0004,
    ])
  })

  it('returns undefined for missing or invalid spacing', () => {
    expect(readPixelSpacing({})).toBeUndefined()
    expect(readPixelSpacing(level([0.1]))).toBeUndefined()
    expect(readPixelSpacing(level([0, 0.1]))).toBeUndefined()
    expect(readPixelSpacing(level(['', 'x']))).toBeUndefined()
  })
})

describe('minimumPixelSpacing', () => {
  it('picks the finest level regardless of order', () => {
    expect(
      minimumPixelSpacing([
        level([0.004, 0.004]),
        level([0.00025, 0.00025]),
        level([0.001, 0.001]),
      ]),
    ).toBe(0.00025)
  })

  it('skips levels without spacing', () => {
    expect(minimumPixelSpacing([{}, level([0.002, 0.001])])).toBe(0.001)
    expect(minimumPixelSpacing([])).toBeUndefined()
  })
})

function opticalPaths(...powers: unknown[]): { OpticalPathSequence: unknown } {
  return {
    OpticalPathSequence: powers.map((power) => ({ ObjectiveLensPower: power })),
  }
}

describe('formatNominalMagnification', () => {
  it('maps nominal resolutions to objective magnifications', () => {
    expect(formatNominalMagnification(0.125)).toBe('80×')
    expect(formatNominalMagnification(0.25)).toBe('40×')
    expect(formatNominalMagnification(0.5)).toBe('20×')
    expect(formatNominalMagnification(1)).toBe('10×')
    expect(formatNominalMagnification(2)).toBe('5×')
  })

  it('labels typical 40× scans slightly coarser than 0.25 µm/px as 40×', () => {
    expect(formatNominalMagnification(0.2527)).toBe('40×')
    expect(formatNominalMagnification(0.263)).toBe('40×')
  })

  it.each([
    [0.1, '80×'],
    [0.176, '80×'],
    [0.178, '40×'],
    [0.353, '40×'],
    [0.355, '20×'],
    [0.7, '20×'],
    [0.72, '10×'],
    [1.4, '10×'],
    [1.42, '5×'],
    [8, '5×'],
  ])('splits objectives at geometric midpoints (%p µm/px → %s)', (mpp, label) => {
    expect(formatNominalMagnification(mpp)).toBe(label)
  })

  it('returns an empty string for invalid resolutions', () => {
    expect(formatNominalMagnification(0)).toBe('')
    expect(formatNominalMagnification(-0.25)).toBe('')
    expect(formatNominalMagnification(Number.NaN)).toBe('')
    expect(formatNominalMagnification(Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('readObjectiveLensPower', () => {
  it('reads numeric and string powers across images and optical paths', () => {
    expect(readObjectiveLensPower([opticalPaths(20)])).toBe(20)
    expect(readObjectiveLensPower([opticalPaths('20', '40.0')])).toBe(40)
    expect(readObjectiveLensPower([opticalPaths(10), opticalPaths(40)])).toBe(
      40,
    )
  })

  it('ignores missing, non-positive and malformed powers', () => {
    expect(readObjectiveLensPower([])).toBeUndefined()
    expect(readObjectiveLensPower([{}])).toBeUndefined()
    expect(
      readObjectiveLensPower([{ OpticalPathSequence: 'not a sequence' }]),
    ).toBeUndefined()
    expect(
      readObjectiveLensPower([
        opticalPaths(0, -40, '', 'x', null),
        { OpticalPathSequence: [null, 'item'] },
      ]),
    ).toBeUndefined()
  })
})

describe('getMagnification', () => {
  it('uses the base level even when it is not listed first', () => {
    expect(
      getMagnification({
        volumeImages: [level([0.004, 0.004]), level([0.00025, 0.00025])],
      }),
    ).toBe('40×')
  })

  it('labels a 0.2527 µm/px base level as 40×', () => {
    expect(
      getMagnification({ volumeImages: [level([0.0002527, 0.0002527])] }),
    ).toBe('40×')
  })

  it('prefers the objective lens power from the metadata', () => {
    expect(
      getMagnification({
        volumeImages: [
          { ...level([0.0002527, 0.0002527]), ...opticalPaths(20) },
        ],
      }),
    ).toBe('20×')
    expect(getMagnification({ volumeImages: [opticalPaths('2.5')] })).toBe(
      '2.5×',
    )
  })

  it('falls back to the pixel spacing when the lens power is not positive', () => {
    expect(
      getMagnification({
        volumeImages: [{ ...level([0.0005, 0.0005]), ...opticalPaths(0) }],
      }),
    ).toBe('20×')
  })

  it('returns an empty string without lens power or spacing', () => {
    expect(getMagnification({ volumeImages: [] })).toBe('')
  })
})

describe('getSlideStainInfo', () => {
  it('prefers the slide description', () => {
    expect(
      getSlideStainInfo({ description: 'H&E', seriesDescription: 'Series' }),
    ).toBe('H&E')
  })

  it('falls back to the series description', () => {
    expect(
      getSlideStainInfo({ description: '  ', seriesDescription: 'PAS' }),
    ).toBe('PAS')
    expect(getSlideStainInfo({})).toBe('')
  })
})

describe('getIlluminationType', () => {
  it('maps monochrome volumes to fluorescence', () => {
    expect(getIlluminationType({ areVolumeImagesMonochrome: true })).toBe(
      'Fluorescence',
    )
    expect(getIlluminationType({ areVolumeImagesMonochrome: false })).toBe(
      'Brightfield',
    )
  })
})

describe('getSlideDisplayId', () => {
  it('keeps the full container identifier so slides do not collide', () => {
    expect(getSlideDisplayId({ containerIdentifier: 'S24-01542-A1' })).toBe(
      'S24-01542-A1',
    )
    expect(getSlideDisplayId({ containerIdentifier: 'S24-01542-A2' })).toBe(
      'S24-01542-A2',
    )
  })

  it('falls back to an index-based label', () => {
    expect(getSlideDisplayId({ containerIdentifier: '' }, 2)).toBe('Slide 3')
    expect(getSlideDisplayId({})).toBe('Slide')
  })
})

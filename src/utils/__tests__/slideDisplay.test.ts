import {
  formatNominalMagnification,
  getIlluminationType,
  getMagnification,
  getSlideDisplayId,
  getSlideStainInfo,
  minimumPixelSpacing,
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

describe('formatNominalMagnification', () => {
  it('maps resolutions to objective magnifications', () => {
    expect(formatNominalMagnification(0.1)).toBe('80×')
    expect(formatNominalMagnification(0.25)).toBe('40×')
    expect(formatNominalMagnification(0.5)).toBe('20×')
    expect(formatNominalMagnification(1)).toBe('10×')
    expect(formatNominalMagnification(4)).toBe('5×')
    expect(formatNominalMagnification(0)).toBe('')
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

  it('returns an empty string without spacing', () => {
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

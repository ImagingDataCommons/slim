import {
  getOpticalPathMeta,
  getOpticalPathName,
  getOpticalPathSwatch,
} from '../opticalPath'

describe('getOpticalPathName', () => {
  it('uses the description when present', () => {
    expect(
      getOpticalPathName({
        identifier: '1',
        description: ' DAPI ',
        isMonochromatic: true,
      }),
    ).toBe('DAPI')
  })

  it('names RGB paths without a description "Brightfield"', () => {
    expect(
      getOpticalPathName({ identifier: '1', isMonochromatic: false }),
    ).toBe('Brightfield')
  })

  it('falls back to the identifier for monochrome channels', () => {
    expect(
      getOpticalPathName({
        identifier: 'CD8',
        description: '',
        isMonochromatic: true,
      }),
    ).toBe('CD8')
  })
})

describe('getOpticalPathMeta', () => {
  it('prefixes stains for RGB paths and mentions ICC profiles', () => {
    expect(
      getOpticalPathMeta(
        { identifier: '1', isMonochromatic: false },
        { hasIccProfile: true, stains: ['hematoxylin', 'eosin'] },
      ),
    ).toBe('hematoxylin, eosin · RGB · ICC profile')
    expect(
      getOpticalPathMeta({ identifier: '1', isMonochromatic: false }),
    ).toBe('RGB')
  })

  it('shows both wavelength and illumination color', () => {
    expect(
      getOpticalPathMeta({
        identifier: '2',
        isMonochromatic: true,
        illuminationWaveLength: '405',
        illuminationColor: { CodeMeaning: 'Blue' },
      }),
    ).toBe('405 nm · Blue')
  })

  it('shows whichever illumination info exists', () => {
    expect(
      getOpticalPathMeta({
        identifier: '2',
        isMonochromatic: true,
        illuminationColor: { CodeMeaning: 'Red' },
      }),
    ).toBe('Red')
    expect(
      getOpticalPathMeta(
        { identifier: '2', isMonochromatic: true },
        { stains: ['DAPI'] },
      ),
    ).toBe('DAPI')
  })
})

describe('getOpticalPathSwatch', () => {
  it('uses a fixed gradient for RGB paths', () => {
    expect(getOpticalPathSwatch({ isMonochromatic: false }, {})).toContain(
      'linear-gradient(135deg',
    )
  })

  it('prefers the palette LUT over the pseudo-color', () => {
    expect(
      getOpticalPathSwatch(
        { isMonochromatic: true },
        {
          color: [255, 0, 0],
          paletteColorLookupTable: {
            data: [
              [0, 0, 0],
              [255, 255, 255],
            ],
          },
        },
      ),
    ).toBe('linear-gradient(90deg, #000000 0%, #ffffff 100%)')
  })

  it('uses the pseudo-color or nothing', () => {
    expect(
      getOpticalPathSwatch({ isMonochromatic: true }, { color: [0, 255, 0] }),
    ).toBe('#00ff00')
    expect(getOpticalPathSwatch({ isMonochromatic: true }, {})).toBeUndefined()
  })
})

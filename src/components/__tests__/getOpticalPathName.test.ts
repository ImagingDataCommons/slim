import { getOpticalPathName } from '../OpticalPathItem'

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

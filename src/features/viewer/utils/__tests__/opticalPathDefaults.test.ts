import { planDefaultOpticalPaths } from '../opticalPathDefaults'

describe('planDefaultOpticalPaths', () => {
  it('shows color paths and monochrome paths with a palette', () => {
    expect(
      planDefaultOpticalPaths([
        { identifier: 'rgb', isMonochromatic: false },
        { identifier: 'dapi', isMonochromatic: true },
        {
          identifier: 'cy5',
          isMonochromatic: true,
          paletteColorLookupTableUID: 'lut',
        },
      ]),
    ).toEqual({ visibleIdentifiers: ['rgb', 'cy5'], colorAssignments: [] })
  })

  it('falls back to the first monochrome path in white', () => {
    expect(
      planDefaultOpticalPaths([
        { identifier: 'dapi', isMonochromatic: true },
        {
          identifier: 'fitc',
          isMonochromatic: true,
          paletteColorLookupTableUID: null,
        },
      ]),
    ).toEqual({
      visibleIdentifiers: ['dapi'],
      colorAssignments: [{ identifier: 'dapi', color: [255, 255, 255] }],
    })
  })

  it('shows nothing without optical paths', () => {
    expect(planDefaultOpticalPaths([])).toEqual({
      visibleIdentifiers: [],
      colorAssignments: [],
    })
  })
})

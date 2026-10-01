import * as dcmjs from 'dcmjs'

import {
  buildDefaultRoiStyle,
  formatRoiRemovalMessage,
  getRoiKey,
  roiStrokeToCssColor,
} from '../roiUtils'

describe('getRoiKey', () => {
  const finding = (value: string, schemeDesignator: string) =>
    new dcmjs.sr.valueTypes.CodeContentItem({
      name: new dcmjs.sr.coding.CodedConcept({
        value: '121071',
        meaning: 'Finding',
        schemeDesignator: 'DCM',
      }),
      value: new dcmjs.sr.coding.CodedConcept({
        value,
        meaning: 'Tissue',
        schemeDesignator,
      }),
      relationshipType: 'CONTAINS',
    })

  it('keys the ROI by its finding as SCHEME:VALUE', () => {
    expect(
      getRoiKey({ uid: 'roi-1', evaluations: [finding('85756007', 'SCT')] }),
    ).toBe('SCT:85756007')
  })

  it('is undefined for an ROI without a finding', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(getRoiKey({ uid: 'roi-2', evaluations: [] })).toBeUndefined()
    vi.restoreAllMocks()
  })
})

describe('formatRoiRemovalMessage', () => {
  it('uses singular and plural forms', () => {
    expect(formatRoiRemovalMessage(1)).toBe('Annotation was removed')
    expect(formatRoiRemovalMessage(3)).toBe('3 annotations were removed')
  })
})

describe('roiStrokeToCssColor', () => {
  it('converts RGB and RGBA strokes, ignoring alpha', () => {
    expect(roiStrokeToCssColor([255, 234, 0], 'fallback')).toBe(
      'rgb(255, 234, 0)',
    )
    expect(roiStrokeToCssColor([0, 153, 255, 0.4], 'fallback')).toBe(
      'rgb(0, 153, 255)',
    )
  })

  it('rounds and clamps channels', () => {
    expect(roiStrokeToCssColor([12.6, -4, 300], 'fallback')).toBe(
      'rgb(13, 0, 255)',
    )
  })

  it('uses the fallback for missing or malformed colors', () => {
    expect(roiStrokeToCssColor(undefined, 'rgb(var(--primary))')).toBe(
      'rgb(var(--primary))',
    )
    expect(roiStrokeToCssColor([1, 2], 'fallback')).toBe('fallback')
    expect(roiStrokeToCssColor([1, Number.NaN, 3], 'fallback')).toBe('fallback')
  })
})

describe('buildDefaultRoiStyle', () => {
  it('derives fill and point style from the stroke preference', () => {
    expect(
      buildDefaultRoiStyle({
        strokeColor: [31, 90, 209],
        strokeWidth: 3,
        radius: 5,
      }),
    ).toEqual({
      stroke: { color: [31, 90, 209], width: 3 },
      fill: { color: [31, 90, 209, 0.2] },
      image: { circle: { fill: { color: [31, 90, 209] }, radius: 5 } },
    })
  })
})

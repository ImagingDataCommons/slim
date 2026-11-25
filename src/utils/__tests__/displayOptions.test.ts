import {
  buildAnnotationGroupDisplayOptions,
  buildClusteringThresholdInput,
  buildMappingDisplayOptions,
  buildOpticalPathDisplayOptions,
  buildSegmentDisplayOptions,
} from '../displayOptions'

describe('buildOpticalPathDisplayOptions', () => {
  it('builds ICC and gamma options', () => {
    const options = buildOpticalPathDisplayOptions({
      iccProfileEnabled: true,
      gammaEnabled: false,
      hasIccProfiles: true,
    })
    expect(options.map((option) => [option.id, option.enabled])).toEqual([
      ['icc', true],
      ['gamma', false],
    ])
    expect(options[0].disabled).toBe(false)
  })

  it('disables ICC when the slide has no profiles', () => {
    const [icc] = buildOpticalPathDisplayOptions({
      iccProfileEnabled: true,
      gammaEnabled: true,
      hasIccProfiles: false,
    })
    expect(icc.disabled).toBe(true)
    expect(icc.description).toBe('This slide has no ICC profiles.')
  })

  it('treats unknown ICC availability as available', () => {
    const [icc] = buildOpticalPathDisplayOptions({
      iccProfileEnabled: false,
      gammaEnabled: false,
    })
    expect(icc.disabled).toBe(false)
  })

  it('locks ICC while the viewport redraws after a toggle', () => {
    const [icc] = buildOpticalPathDisplayOptions({
      iccProfileEnabled: false,
      gammaEnabled: false,
      hasIccProfiles: true,
      isUpdatingColors: true,
    })
    expect(icc.disabled).toBe(true)
    expect(icc.busy).toBe(true)
    expect(icc.description).toBe('Updating colors in the viewport…')
  })

  it('disables turning gamma on when nothing shown is palette colored', () => {
    const [, noPalette] = buildOpticalPathDisplayOptions({
      iccProfileEnabled: true,
      gammaEnabled: false,
      usesPalette: false,
    })
    expect(noPalette.disabled).toBe(true)
    /** Gamma that is on can still be turned off */
    const [, onWithoutPalette] = buildOpticalPathDisplayOptions({
      iccProfileEnabled: true,
      gammaEnabled: true,
      usesPalette: false,
    })
    expect(onWithoutPalette.disabled).toBe(false)
    const [, withPalette] = buildOpticalPathDisplayOptions({
      iccProfileEnabled: true,
      gammaEnabled: true,
      usesPalette: true,
    })
    expect(withPalette.disabled).toBe(false)
  })
})

describe('buildSegmentDisplayOptions', () => {
  it('builds the interpolation option only', () => {
    expect(buildSegmentDisplayOptions({ interpolationEnabled: false })).toEqual(
      [
        expect.objectContaining({
          id: 'interpolation',
          shortLabel: 'Interp.',
          enabled: false,
        }),
      ],
    )
  })
})

describe('buildMappingDisplayOptions', () => {
  it('builds the interpolation option', () => {
    expect(buildMappingDisplayOptions({ interpolationEnabled: true })).toEqual([
      expect.objectContaining({ id: 'interpolation', enabled: true }),
    ])
  })
})

describe('buildAnnotationGroupDisplayOptions', () => {
  it('builds the clustering option', () => {
    expect(
      buildAnnotationGroupDisplayOptions({ clusteringEnabled: false }),
    ).toEqual([
      expect.objectContaining({
        id: 'clustering',
        enabled: false,
        description: 'Group dense annotations at low zoom.',
      }),
    ])
  })
})

describe('buildClusteringThresholdInput', () => {
  it('passes the raw input text through', () => {
    expect(buildClusteringThresholdInput('0.').inputValue).toBe('0.')
    expect(buildClusteringThresholdInput('').unit).toBe('mm')
  })
})

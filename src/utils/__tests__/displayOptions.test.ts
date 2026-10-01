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
})

describe('buildSegmentDisplayOptions', () => {
  it('lists clustering only when provided', () => {
    expect(
      buildSegmentDisplayOptions({ interpolationEnabled: true }).map(
        (option) => option.id,
      ),
    ).toEqual(['interpolation'])
    expect(
      buildSegmentDisplayOptions({
        interpolationEnabled: false,
        clusteringEnabled: true,
      }).map((option) => [option.id, option.enabled]),
    ).toEqual([
      ['clustering', true],
      ['interpolation', false],
    ])
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

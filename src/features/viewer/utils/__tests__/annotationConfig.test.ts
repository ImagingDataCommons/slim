import {
  buildAnnotationConfig,
  DEFAULT_GEOMETRY_TYPES,
} from '../annotationConfig'

const TUMOR = { value: '108369006', schemeDesignator: 'SCT', meaning: 'Tumor' }
const NECROSIS = {
  value: '6574001',
  schemeDesignator: 'SCT',
  meaning: 'Necrosis',
}

describe('buildAnnotationConfig', () => {
  it('keys the options of each finding by its coded concept', () => {
    const config = buildAnnotationConfig([
      {
        finding: TUMOR,
        geometryTypes: ['polygon'],
        evaluations: [
          {
            name: { value: '1', schemeDesignator: 'DCM', meaning: 'Grade' },
            values: [{ value: '2', schemeDesignator: 'DCM', meaning: 'High' }],
          },
        ],
        style: {
          stroke: { color: [255, 0, 0], width: 3 },
          fill: { color: [255, 0, 0, 0.5] },
        },
      },
      { finding: NECROSIS },
    ])

    expect(config.findings.map((finding) => finding.CodeMeaning)).toEqual([
      'Tumor',
      'Necrosis',
    ])
    expect(config.geometryTypes).toEqual({
      'SCT:108369006': ['polygon'],
      'SCT:6574001': DEFAULT_GEOMETRY_TYPES,
    })
    const [grade] = config.evaluationOptions['SCT:108369006']
    expect(grade.name.CodeMeaning).toBe('Grade')
    expect(grade.values.map((value) => value.CodeMeaning)).toEqual(['High'])
    expect(config.evaluationOptions['SCT:6574001']).toEqual([])
    expect(config.configuredStyles['SCT:108369006'].stroke).toEqual({
      color: [255, 0, 0],
      width: 3,
    })
    expect(Object.keys(config.configuredStyles)).toEqual(['SCT:108369006'])
    expect(config.findingCategories).toEqual({})
  })

  it('maps findingCategory per finding key', () => {
    const config = buildAnnotationConfig([
      {
        finding: TUMOR,
        findingCategory: {
          value: '49755003',
          schemeDesignator: 'SCT',
          meaning: 'Morphologically abnormal structure',
        },
      },
    ])
    expect(config.findingCategories['SCT:108369006']?.CodeMeaning).toBe(
      'Morphologically abnormal structure',
    )
  })

  it('is empty without configured annotations', () => {
    expect(buildAnnotationConfig([])).toEqual({
      findings: [],
      findingCategories: {},
      evaluationOptions: {},
      geometryTypes: {},
      configuredStyles: {},
    })
  })
})

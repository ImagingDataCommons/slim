import { measurementOptionToConcept } from '../annotationGroupMeasurement'

describe('measurementOptionToConcept', () => {
  it('maps the option fields onto a coded concept', () => {
    const concept = measurementOptionToConcept({
      key: 'DCM:121401',
      value: '121401',
      schemeDesignator: 'DCM',
      meaning: 'Area',
    })
    expect(concept.CodeValue).toBe('121401')
    expect(concept.CodingSchemeDesignator).toBe('DCM')
    expect(concept.CodeMeaning).toBe('Area')
  })
})

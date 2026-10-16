import {
  codedConceptDisplayText,
  codedConceptKey,
  formatCodedConceptSequence,
  isSameCodedConcept,
} from '../codedConcept'

describe('codedConceptKey', () => {
  it('joins scheme and value with a colon', () => {
    expect(
      codedConceptKey({
        CodingSchemeDesignator: 'SCT',
        CodeValue: '108369006',
      }),
    ).toBe('SCT:108369006')
  })

  it('keeps hyphenated code values unambiguous', () => {
    expect(
      codedConceptKey({ CodingSchemeDesignator: '99LOCAL', CodeValue: 'A-1' }),
    ).toBe('99LOCAL:A-1')
  })

  it('treats missing parts as empty', () => {
    expect(codedConceptKey({})).toBe(':')
  })
})

describe('isSameCodedConcept', () => {
  const tumor = {
    CodingSchemeDesignator: 'SCT',
    CodeValue: '108369006',
    CodeMeaning: 'Tumor',
  }

  it('ignores the meaning', () => {
    expect(
      isSameCodedConcept(tumor, { ...tumor, CodeMeaning: 'Neoplasm' }),
    ).toBe(true)
  })

  it('requires the same scheme and value', () => {
    expect(
      isSameCodedConcept(tumor, { ...tumor, CodingSchemeDesignator: 'DCM' }),
    ).toBe(false)
    expect(isSameCodedConcept(tumor, { ...tumor, CodeValue: '1' })).toBe(false)
  })
})

describe('codedConceptDisplayText', () => {
  it('prefers the trimmed meaning', () => {
    expect(
      codedConceptDisplayText({
        CodeMeaning: ' Homo sapiens ',
        CodeValue: '1',
      }),
    ).toBe('Homo sapiens')
  })

  it('falls back to the code value except for SNOMED CT', () => {
    expect(
      codedConceptDisplayText({
        CodingSchemeDesignator: 'DCM',
        CodeValue: '42',
      }),
    ).toBe('42')
    expect(
      codedConceptDisplayText({
        CodingSchemeDesignator: 'sct',
        CodeValue: '42',
      }),
    ).toBe('')
  })

  it('returns an empty string for non-objects', () => {
    expect(codedConceptDisplayText(null)).toBe('')
    expect(codedConceptDisplayText('Tumor')).toBe('')
    expect(codedConceptDisplayText({})).toBe('')
  })
})

describe('formatCodedConceptSequence', () => {
  it('joins display texts and drops case-insensitive duplicates', () => {
    expect(
      formatCodedConceptSequence([
        { CodeMeaning: 'Carcinoma' },
        { CodeMeaning: 'carcinoma' },
        { CodingSchemeDesignator: 'SCT', CodeValue: '1' },
        { CodeMeaning: 'Adenoma' },
      ]),
    ).toBe('Carcinoma, Adenoma')
  })

  it('returns an empty string for non-arrays', () => {
    expect(formatCodedConceptSequence(undefined)).toBe('')
    expect(formatCodedConceptSequence({ CodeMeaning: 'x' })).toBe('')
  })
})

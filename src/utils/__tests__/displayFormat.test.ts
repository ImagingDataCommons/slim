import {
  buildStudySummary,
  formatAdmittingDiagnoses,
  formatDisplayDate,
  formatDisplayTime,
  formatGroupedNumber,
  formatMultiValue,
  formatPatientSpeciesCodeSequence,
  formatPersonName,
  formatSex,
  formatStudyDateTime,
  formatStudyLabel,
} from '../displayFormat'

describe('formatStudyDateTime', () => {
  it('joins date and time', () => {
    expect(formatStudyDateTime('20260912', '094215')).toBe('12 Sep 2026, 09:42')
  })

  it('omits missing parts', () => {
    expect(formatStudyDateTime('20260912', undefined)).toBe('12 Sep 2026')
    expect(formatStudyDateTime(undefined, '0942')).toBe('09:42')
    expect(formatStudyDateTime(undefined, undefined)).toBe('')
  })
})

describe('formatStudyLabel', () => {
  it('combines the study ID and date', () => {
    expect(formatStudyLabel('S24-01542', 'ACC1', '20260912')).toBe(
      'S24-01542 · 12 Sep 2026',
    )
  })

  it('falls back to the accession number', () => {
    expect(formatStudyLabel('', 'ACC1', '20260912')).toBe('ACC1 · 12 Sep 2026')
    expect(formatStudyLabel(undefined, 'ACC1', undefined)).toBe('ACC1')
  })

  it('returns an empty string without identifiers or date', () => {
    expect(formatStudyLabel(undefined, undefined, undefined)).toBe('')
  })
})

describe('buildStudySummary', () => {
  it('builds the header breadcrumb labels', () => {
    expect(
      buildStudySummary({
        PatientName: { Alphabetic: 'Whitfield^Margaret^Anne' },
        StudyID: 'S24-01542',
        StudyDate: '20260912',
      }),
    ).toEqual({
      patientName: 'Whitfield, Margaret A.',
      studyLabel: 'S24-01542 · 12 Sep 2026',
    })
  })
})

describe('formatDisplayDate', () => {
  it('formats DICOM DA values', () => {
    expect(formatDisplayDate('20260912')).toBe('12 Sep 2026')
    expect(formatDisplayDate('2026-01-05')).toBe('05 Jan 2026')
  })

  it('returns the trimmed input when the date cannot be parsed', () => {
    expect(formatDisplayDate(' 2026 ')).toBe('2026')
    expect(formatDisplayDate('20261301')).toBe('20261301')
    expect(formatDisplayDate('20260900')).toBe('20260900')
  })

  it('rejects impossible calendar dates', () => {
    expect(formatDisplayDate('20260231')).toBe('20260231')
  })

  it('formats the date part of DICOM DT values', () => {
    expect(formatDisplayDate('20260912094215')).toBe('12 Sep 2026')
    expect(formatDisplayDate('2026.09.12')).toBe('12 Sep 2026')
  })

  it('returns an empty string for missing values', () => {
    expect(formatDisplayDate(undefined)).toBe('')
    expect(formatDisplayDate(null)).toBe('')
  })
})

describe('formatDisplayTime', () => {
  it('keeps hours and minutes', () => {
    expect(formatDisplayTime('094215.123')).toBe('09:42')
    expect(formatDisplayTime('09:42:15')).toBe('09:42')
  })

  it('returns short or missing values unchanged', () => {
    expect(formatDisplayTime('09')).toBe('09')
    expect(formatDisplayTime(undefined)).toBe('')
  })
})

describe('formatPersonName', () => {
  it('formats family, given and middle initials', () => {
    expect(formatPersonName('Whitfield^Margaret^Anne')).toBe(
      'Whitfield, Margaret A.',
    )
  })

  it('accepts DICOM JSON PN objects and arrays', () => {
    expect(formatPersonName({ Alphabetic: 'Okafor^R' })).toBe('Okafor, R')
    expect(formatPersonName([{ Alphabetic: 'Doe^Jane' }])).toBe('Doe, Jane')
  })

  it('keeps prefix and suffix around the name', () => {
    expect(formatPersonName('Tanaka^Hiro^^Dr.^PhD')).toBe(
      'Dr. Tanaka, Hiro PhD',
    )
  })

  it('handles single components and empty values', () => {
    expect(formatPersonName('PBCFZC')).toBe('PBCFZC')
    expect(formatPersonName('^Jane')).toBe('Jane')
    expect(formatPersonName('')).toBe('')
    expect(formatPersonName(undefined)).toBe('')
  })
})

describe('formatGroupedNumber', () => {
  it('groups thousands with spaces', () => {
    expect(formatGroupedNumber(18402)).toBe('18 402')
    expect(formatGroupedNumber(1234567)).toBe('1 234 567')
    expect(formatGroupedNumber(999)).toBe('999')
  })

  it('rounds and keeps the sign', () => {
    expect(formatGroupedNumber(-1234.6)).toBe('-1 235')
  })

  it('returns an empty string for non-finite numbers', () => {
    expect(formatGroupedNumber(Number.NaN)).toBe('')
    expect(formatGroupedNumber(Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('formatSex', () => {
  it('maps DICOM codes to labels', () => {
    expect(formatSex('F')).toBe('Female')
    expect(formatSex('m')).toBe('Male')
    expect(formatSex('O')).toBe('Other')
  })

  it('returns unknown codes unchanged', () => {
    expect(formatSex('X')).toBe('X')
    expect(formatSex(undefined)).toBe('')
  })
})

describe('formatMultiValue', () => {
  it('joins arrays', () => {
    expect(formatMultiValue(['1.0', '2.3'])).toBe('1.0, 2.3')
  })

  it('splits backslash-delimited strings', () => {
    expect(formatMultiValue('1.0\\ 2.3 ')).toBe('1.0, 2.3')
    expect(formatMultiValue('Scanner 4')).toBe('Scanner 4')
  })

  it('stringifies scalars and drops empty items', () => {
    expect(formatMultiValue(3)).toBe('3')
    expect(formatMultiValue(true)).toBe('true')
    expect(formatMultiValue(['', null, 'a'])).toBe('a')
  })

  it('returns an empty string for missing or object values', () => {
    expect(formatMultiValue(undefined)).toBe('')
    expect(formatMultiValue(null)).toBe('')
    expect(formatMultiValue({ a: 1 })).toBe('')
  })
})

describe('formatPatientSpeciesCodeSequence', () => {
  it('lists unique species meanings', () => {
    expect(
      formatPatientSpeciesCodeSequence([
        { CodeMeaning: 'Homo sapiens' },
        { CodeMeaning: 'homo sapiens' },
        { CodeMeaning: 'Mus musculus' },
      ]),
    ).toBe('Homo sapiens, Mus musculus')
  })

  it('returns undefined when nothing displayable is present', () => {
    expect(formatPatientSpeciesCodeSequence(undefined)).toBeUndefined()
    expect(formatPatientSpeciesCodeSequence([])).toBeUndefined()
    expect(
      formatPatientSpeciesCodeSequence([
        { CodingSchemeDesignator: 'SCT', CodeValue: '337915000' },
      ]),
    ).toBeUndefined()
  })
})

describe('formatAdmittingDiagnoses', () => {
  const carcinoma = { CodeMeaning: 'Carcinoma' }

  it('combines the description and the coded diagnoses', () => {
    expect(
      formatAdmittingDiagnoses({
        AdmittingDiagnosesDescription: ' Suspected tumor ',
        AdmittingDiagnosesCodeSequence: [carcinoma, { CodeMeaning: 'Adenoma' }],
      }),
    ).toBe('Suspected tumor; Carcinoma, Adenoma')
  })

  it('shows the description once when the codes repeat it', () => {
    expect(
      formatAdmittingDiagnoses({
        AdmittingDiagnosesDescription: 'carcinoma',
        AdmittingDiagnosesCodeSequence: [carcinoma],
      }),
    ).toBe('carcinoma')
  })

  it('accepts singular and legacy keywords', () => {
    expect(
      formatAdmittingDiagnoses({ AdmittingDiagnosisDescription: 'Biopsy' }),
    ).toBe('Biopsy')
    expect(
      formatAdmittingDiagnoses({ AdmittingDiagnosisCodeSeq: [carcinoma] }),
    ).toBe('Carcinoma')
  })

  it('skips blank descriptions and empty sequences', () => {
    expect(
      formatAdmittingDiagnoses({
        AdmittingDiagnosesDescription: '  ',
        AdmittingDiagnosisDescription: 'Biopsy',
        AdmittingDiagnosesCodeSequence: [],
        AdmittingDiagnosisCodeSequence: [carcinoma],
      }),
    ).toBe('Biopsy; Carcinoma')
  })

  it('returns undefined without description or codes', () => {
    expect(formatAdmittingDiagnoses({})).toBeUndefined()
    expect(
      formatAdmittingDiagnoses({ AdmittingDiagnosesCodeSequence: [{}] }),
    ).toBeUndefined()
  })
})

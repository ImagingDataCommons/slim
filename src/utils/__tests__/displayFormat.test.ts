import {
  buildStudySummary,
  formatDisplayDate,
  formatDisplayTime,
  formatGroupedNumber,
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
    expect(formatStudyLabel('', 'ACC1', '20260912')).toBe(
      'ACC1 · 12 Sep 2026',
    )
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

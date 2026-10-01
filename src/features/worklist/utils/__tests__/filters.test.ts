import type { metadata } from 'dicom-microscopy-viewer'

import {
  filterStudiesByDateRange,
  filterStudiesBySearchText,
  isToday,
  isWithinLastDays,
  modalitiesNeedBackfill,
  parseDicomDate,
} from '../filters'

const NOW = new Date(2026, 8, 12, 15, 30)

function study(fields: Record<string, unknown>): metadata.Study {
  return fields as unknown as metadata.Study
}

describe('parseDicomDate', () => {
  it('parses YYYYMMDD', () => {
    expect(parseDicomDate('20260912')).toEqual(new Date(2026, 8, 12))
  })

  it('rejects malformed or impossible dates', () => {
    expect(parseDicomDate(undefined)).toBeNull()
    expect(parseDicomDate('')).toBeNull()
    expect(parseDicomDate('2026-09-12')).toBeNull()
    expect(parseDicomDate('20260231')).toBeNull()
  })
})

describe('isToday', () => {
  it('compares calendar days with the injected now', () => {
    expect(isToday(new Date(2026, 8, 12), NOW)).toBe(true)
    expect(isToday(new Date(2026, 8, 11), NOW)).toBe(false)
    expect(isToday(new Date(2025, 8, 12), NOW)).toBe(false)
  })
})

describe('isWithinLastDays', () => {
  it('includes the whole day N days ago', () => {
    expect(isWithinLastDays(new Date(2026, 8, 5), 7, NOW)).toBe(true)
    expect(isWithinLastDays(new Date(2026, 8, 4), 7, NOW)).toBe(false)
  })

  it('includes today', () => {
    expect(isWithinLastDays(new Date(2026, 8, 12), 7, NOW)).toBe(true)
  })

  it('excludes future dates', () => {
    expect(isWithinLastDays(new Date(2026, 8, 13), 7, NOW)).toBe(false)
    expect(isWithinLastDays(new Date(2027, 0, 1), 7, NOW)).toBe(false)
  })
})

describe('filterStudiesByDateRange', () => {
  const studies = [
    study({ StudyInstanceUID: 'today', StudyDate: '20260912' }),
    study({ StudyInstanceUID: 'last-week', StudyDate: '20260907' }),
    study({ StudyInstanceUID: 'old', StudyDate: '20250101' }),
    study({ StudyInstanceUID: 'future', StudyDate: '20261001' }),
    study({ StudyInstanceUID: 'missing' }),
  ]
  const uids = (list: metadata.Study[]): string[] =>
    list.map((item) => item.StudyInstanceUID)

  it('returns every study for "all"', () => {
    expect(filterStudiesByDateRange(studies, 'all', NOW)).toBe(studies)
  })

  it('keeps only today for "today"', () => {
    expect(uids(filterStudiesByDateRange(studies, 'today', NOW))).toEqual([
      'today',
    ])
  })

  it('keeps the last seven days without future dates for "week"', () => {
    expect(uids(filterStudiesByDateRange(studies, 'week', NOW))).toEqual([
      'today',
      'last-week',
    ])
  })
})

describe('filterStudiesBySearchText', () => {
  const studies = [
    study({
      StudyInstanceUID: '1',
      PatientName: { Alphabetic: 'Whitfield^Margaret^Ann' },
      PatientID: 'P-001',
      AccessionNumber: 'ACC-77',
      StudyID: 'S24-01542',
    }),
    study({
      StudyInstanceUID: '2',
      PatientName: 'Doe^Jane',
      PatientID: 'P-002',
    }),
    study({ StudyInstanceUID: '3' }),
  ]
  const search = (text: string): string[] =>
    filterStudiesBySearchText(studies, text).map(
      (item) => item.StudyInstanceUID,
    )

  it('returns every study for blank search', () => {
    expect(filterStudiesBySearchText(studies, '   ')).toBe(studies)
  })

  it('matches identifiers case-insensitively', () => {
    expect(search('p-002')).toEqual(['2'])
    expect(search('acc-77')).toEqual(['1'])
    expect(search('s24')).toEqual(['1'])
  })

  it('matches the displayed patient name', () => {
    expect(search('Whitfield, Margaret A.')).toEqual(['1'])
    expect(search('doe, jane')).toEqual(['2'])
  })

  it('matches the raw patient name components', () => {
    expect(search('margaret ann')).toEqual(['1'])
    expect(search('doe jane')).toEqual(['2'])
  })

  it('trims the search text', () => {
    expect(search('  jane ')).toEqual(['2'])
  })
})

describe('modalitiesNeedBackfill', () => {
  it('is true when no usable modality is present', () => {
    expect(modalitiesNeedBackfill(study({}))).toBe(true)
    expect(modalitiesNeedBackfill(study({ ModalitiesInStudy: '' }))).toBe(true)
    expect(modalitiesNeedBackfill(study({ ModalitiesInStudy: [' '] }))).toBe(
      true,
    )
  })

  it('is false when a modality is present', () => {
    expect(modalitiesNeedBackfill(study({ ModalitiesInStudy: 'SM' }))).toBe(
      false,
    )
    expect(modalitiesNeedBackfill(study({ ModalitiesInStudy: ['SM'] }))).toBe(
      false,
    )
  })
})

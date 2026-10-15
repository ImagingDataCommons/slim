import type { metadata } from 'dicom-microscopy-viewer'

import {
  appendMissingStudies,
  filterStudiesBySearchText,
  getEmptyStudiesMessage,
  mergeModalities,
  modalitiesNeedBackfill,
} from '../filters'

function study(fields: Record<string, unknown>): metadata.Study {
  return fields as unknown as metadata.Study
}

describe('getEmptyStudiesMessage', () => {
  it('reports no studies without a search', () => {
    expect(getEmptyStudiesMessage()).toBe('No studies found.')
  })

  it('quotes the trimmed search text', () => {
    expect(getEmptyStudiesMessage('  doe ')).toBe('No studies match “doe”.')
  })

  it('ignores blank search text', () => {
    expect(getEmptyStudiesMessage('   ')).toBe('No studies found.')
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

describe('appendMissingStudies', () => {
  const listed = [
    study({ StudyInstanceUID: '1' }),
    study({ StudyInstanceUID: '2' }),
  ]

  it('appends only the studies not already listed', () => {
    const extra = study({ StudyInstanceUID: '3' })
    const merged = appendMissingStudies(listed, [
      study({ StudyInstanceUID: '2' }),
      extra,
    ])
    expect(merged.map((item) => item.StudyInstanceUID)).toEqual(['1', '2', '3'])
    expect(merged[1]).toBe(listed[1])
  })

  it('returns the same list when nothing is missing', () => {
    expect(appendMissingStudies(listed, [])).toBe(listed)
    expect(
      appendMissingStudies(listed, [study({ StudyInstanceUID: '1' })]),
    ).toBe(listed)
  })
})

describe('mergeModalities', () => {
  const listed = study({ StudyInstanceUID: '1', ModalitiesInStudy: ['SM'] })
  const missing = study({ StudyInstanceUID: '2' })

  it('fills in only studies that lack modalities', () => {
    const merged = mergeModalities(
      [listed, missing],
      new Map([
        ['1', ['CT']],
        ['2', ['ANN', 'SM']],
      ]),
    )
    expect(merged[0]).toBe(listed)
    expect(merged[1].ModalitiesInStudy).toEqual(['ANN', 'SM'])
  })

  it('leaves a study alone when the lookup found nothing', () => {
    const merged = mergeModalities([missing], new Map([['2', []]]))
    expect(merged[0]).toBe(missing)
  })

  it('returns the same list without lookups', () => {
    const studies = [listed, missing]
    expect(mergeModalities(studies, new Map())).toBe(studies)
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

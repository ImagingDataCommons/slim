import type { metadata } from 'dicom-microscopy-viewer'

import { CONTAINS_CATALOG } from '../containsCatalog'
import {
  appendMissingStudies,
  filterStudiesBySearchText,
  getEmptyStudiesMessage,
  mergeModalities,
  modalitiesNeedBackfill,
  resolveContainsStudies,
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

  it('treats * and ? as DICOM wildcards over the whole value', () => {
    expect(search('p-00*')).toEqual(['1', '2'])
    expect(search('P-00?')).toEqual(['1', '2'])
    expect(search('*-77')).toEqual(['1'])
    expect(search('doe*')).toEqual(['2'])
    expect(search('00*')).toEqual([])
    expect(search('S24.01542*')).toEqual([])
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

describe('resolveContainsStudies', () => {
  const entry = CONTAINS_CATALOG.find((item) => item.id === 'ann')!
  const matchStudy = study({ StudyInstanceUID: '1', PatientID: 'from-match' })
  const loaded = study({ StudyInstanceUID: '1', PatientID: 'loaded' })
  const fetched = study({ StudyInstanceUID: '1', PatientID: 'fetched' })
  const matches = new Map([
    ['1', { seriesUids: ['s1'], study: matchStudy }],
    [
      '2',
      {
        seriesUids: ['s2'],
        study: study({ StudyInstanceUID: '2', PatientID: 'match-2' }),
      },
    ],
  ])

  it('skips mismatches and prefers loaded then fetched studies', () => {
    const { studies, hasUncheckedMatches } = resolveContainsStudies({
      entry,
      matches,
      loadedStudies: new Map([['1', loaded]]),
      getRowCheck: (uid) => {
        if (uid === '1') return { status: 'match' }
        if (uid === '2') return { status: 'mismatch' }
        return undefined
      },
      needsCheck: () => false,
    })
    expect(studies.map((item) => item.PatientID)).toEqual(['loaded'])
    expect(hasUncheckedMatches).toBe(false)
  })

  it('uses the fetched check study when the row was not loaded', () => {
    const { studies } = resolveContainsStudies({
      entry,
      matches: new Map([['1', { seriesUids: ['s1'], study: matchStudy }]]),
      loadedStudies: new Map(),
      getRowCheck: () => ({ status: 'match', study: fetched }),
      needsCheck: () => false,
    })
    expect(studies[0].PatientID).toBe('fetched')
  })

  it('falls back to the match stub and flags unchecked rows', () => {
    const { studies, hasUncheckedMatches } = resolveContainsStudies({
      entry,
      matches: new Map([['1', { seriesUids: ['s1'], study: matchStudy }]]),
      loadedStudies: new Map(),
      getRowCheck: () => undefined,
      needsCheck: () => true,
    })
    expect(studies[0].PatientID).toBe('from-match')
    expect(studies[0].ModalitiesInStudy).toEqual(
      expect.arrayContaining([entry.modality]),
    )
    expect(hasUncheckedMatches).toBe(true)
  })
})

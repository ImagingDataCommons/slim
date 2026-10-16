import {
  buildStudyQueryParams,
  buildStudySearchQueries,
  extractModalitiesFromSeries,
  STUDY_SEARCH_MIN_LENGTH,
  STUDY_SEARCH_RESULT_LIMIT,
} from '../studyQuery'

describe('buildStudyQueryParams', () => {
  it('restricts to slide microscopy studies and requests the series count', () => {
    expect(buildStudyQueryParams()).toEqual({
      ModalitiesInStudy: 'SM',
      includefield: 'NumberOfStudyRelatedSeries',
    })
  })

  it('returns a fresh object per call', () => {
    expect(buildStudyQueryParams()).not.toBe(buildStudyQueryParams())
  })
})

describe('buildStudySearchQueries', () => {
  const base = {
    ...buildStudyQueryParams(),
    limit: STUDY_SEARCH_RESULT_LIMIT,
  }

  it('sends nothing for blank text', () => {
    expect(buildStudySearchQueries('   ')).toEqual([])
  })

  it('sends nothing for a term shorter than the minimum', () => {
    expect(STUDY_SEARCH_MIN_LENGTH).toBe(2)
    expect(buildStudySearchQueries('P')).toEqual([])
    expect(buildStudySearchQueries(' * ')).toEqual([])
  })

  it('queries each attribute with an exact and a wildcard value', () => {
    expect(buildStudySearchQueries(' C3L-00965 ')).toEqual([
      { ...base, PatientID: 'C3L-00965' },
      { ...base, PatientID: '*C3L-00965*' },
      { ...base, PatientName: 'C3L-00965', fuzzymatching: true },
      { ...base, PatientName: '*C3L-00965*', fuzzymatching: true },
      { ...base, AccessionNumber: 'C3L-00965' },
      { ...base, AccessionNumber: '*C3L-00965*' },
      { ...base, StudyID: 'C3L-00965' },
    ])
  })

  it('sends a term with its own wildcards as typed', () => {
    expect(buildStudySearchQueries('TCGA-*')).toEqual([
      { ...base, PatientID: 'TCGA-*' },
      { ...base, PatientName: 'TCGA-*', fuzzymatching: true },
      { ...base, AccessionNumber: 'TCGA-*' },
      { ...base, StudyID: 'TCGA-*' },
    ])
  })
})

describe('extractModalitiesFromSeries', () => {
  it('reads DICOM JSON modality elements', () => {
    expect(
      extractModalitiesFromSeries([
        { '00080060': { vr: 'CS', Value: ['SM'] } },
        { '00080060': { vr: 'CS', Value: ['ANN'] } },
        { '00080060': { vr: 'CS', Value: ['SM'] } },
      ]),
    ).toEqual(['ANN', 'SM'])
  })

  it('reads keyword-formatted series', () => {
    expect(
      extractModalitiesFromSeries([{ Modality: 'SR' }, { Modality: 'SM' }]),
    ).toEqual(['SM', 'SR'])
  })

  it('skips missing, blank and malformed entries', () => {
    expect(
      extractModalitiesFromSeries([
        null,
        'SM',
        {},
        { '00080060': { vr: 'CS' } },
        { '00080060': { vr: 'CS', Value: ['  '] } },
        { Modality: '' },
      ]),
    ).toEqual([])
  })
})

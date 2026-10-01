import {
  buildStudyQueryParams,
  extractModalitiesFromSeries,
} from '../studyQuery'

describe('buildStudyQueryParams', () => {
  it('restricts to slide microscopy studies by default', () => {
    expect(buildStudyQueryParams()).toEqual({
      ModalitiesInStudy: 'SM',
      includefield: 'NumberOfStudyRelatedSeries',
    })
  })

  it('adds criteria with fuzzy matching and wildcards person names', () => {
    expect(
      buildStudyQueryParams({ PersonName: 'Doe', StudyDate: '20260912' }),
    ).toEqual({
      ModalitiesInStudy: 'SM',
      includefield: 'NumberOfStudyRelatedSeries',
      PersonName: '*Doe*',
      StudyDate: '20260912',
      fuzzymatching: true,
    })
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

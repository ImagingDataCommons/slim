import {
  buildStudyQueryParams,
  extractModalitiesFromSeries,
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

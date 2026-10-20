import { describe, expect, it } from 'vitest'

import { DASH } from '../studyFields'
import { buildWorklistCardFields } from '../worklistCard'

function study(
  overrides: Record<string, unknown> = {},
): Parameters<typeof buildWorklistCardFields>[0] {
  return {
    StudyInstanceUID: '1.2.3',
    PatientName: { Alphabetic: 'first^patient' },
    PatientID: 'P1',
    StudyDate: '20210128',
    AccessionNumber: 'A-99',
    ModalitiesInStudy: ['SM', 'ANN'],
    NumberOfStudyRelatedSeries: 3,
    ...overrides,
  } as Parameters<typeof buildWorklistCardFields>[0]
}

describe('buildWorklistCardFields', () => {
  it('keeps name, id, date, accession, modalities and slide count', () => {
    expect(buildWorklistCardFields(study())).toEqual({
      patientName: 'first, patient',
      patientId: 'P1',
      studyDate: '28 Jan 2021',
      accession: 'A-99',
      modalities: ['SM', 'ANN'],
      slides: 3,
    })
  })

  it('omits accession when the user hid that column', () => {
    expect(
      buildWorklistCardFields(study(), ['AccessionNumber']).accession,
    ).toBeUndefined()
  })

  it('omits a blank accession', () => {
    expect(
      buildWorklistCardFields(study({ AccessionNumber: '' })).accession,
    ).toBeUndefined()
  })

  it('dashes a missing patient name', () => {
    expect(
      buildWorklistCardFields(study({ PatientName: undefined })).patientName,
    ).toBe(DASH)
  })
})

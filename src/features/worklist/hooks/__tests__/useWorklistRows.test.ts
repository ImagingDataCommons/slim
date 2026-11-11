import { renderHook } from '@testing-library/react'
import type { metadata } from 'dicom-microscopy-viewer'

import { useWorklistRows } from '../useWorklistRows'

function study(uid: string, patientName: string): metadata.Study {
  return {
    StudyInstanceUID: uid,
    PatientName: [{ Alphabetic: patientName }],
    ModalitiesInStudy: ['SM'],
  } as unknown as metadata.Study
}

const NO_STUDIES: metadata.Study[] = []

describe('useWorklistRows', () => {
  it('keeps server matches the local substring filter would drop', () => {
    const loaded = [study('1', 'Smith^John')]
    const serverHit = study('2', 'Doe^Jane')
    const { result } = renderHook(() =>
      useWorklistRows({
        studies: loaded,
        serverSearchMatches: [serverHit],
        containsEntry: undefined,
        containsResult: undefined,
        loadedStudies: new Map(),
        getRowCheck: () => undefined,
        deferredSearchText: 'Jane Doe',
        pageStudyUids: [],
        slideClient: undefined,
      }),
    )

    expect(
      result.current.filteredStudies.map((item) => item.StudyInstanceUID),
    ).toEqual(['2'])
  })

  it('still filters loaded studies locally without server matches', () => {
    const { result } = renderHook(() =>
      useWorklistRows({
        studies: [study('1', 'Smith^John'), study('2', 'Doe^Jane')],
        serverSearchMatches: NO_STUDIES,
        containsEntry: undefined,
        containsResult: undefined,
        loadedStudies: new Map(),
        getRowCheck: () => undefined,
        deferredSearchText: 'smith',
        pageStudyUids: [],
        slideClient: undefined,
      }),
    )

    expect(
      result.current.filteredStudies.map((item) => item.StudyInstanceUID),
    ).toEqual(['1'])
  })
})

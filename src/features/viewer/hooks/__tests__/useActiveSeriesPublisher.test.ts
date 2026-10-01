import { renderHook } from '@testing-library/react'

import { ActiveSeriesService } from '../../../../services/ActiveSeriesService'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession } from '../../testing/fixtures'
import { useActiveSeriesPublisher } from '../useActiveSeriesPublisher'

jest.mock(
  'dicom-microscopy-viewer',
  () =>
    jest.requireActual<typeof import('../../testing/fakeDmv')>(
      '../../testing/fakeDmv',
    ).fakeDmvModule,
)
jest.mock('../../../../utils/logger')

beforeEach(() => {
  resetFakeDmv()
  ActiveSeriesService.clear()
})

describe('useActiveSeriesPublisher', () => {
  it('publishes the slide series and the series of visible overlays', () => {
    const { viewer, access } = createTestSession()
    viewer.segments.add({
      uid: 'seg',
      seriesInstanceUID: 'seg-series',
      number: 1,
    })
    viewer.mappings.add({ uid: 'map', seriesInstanceUID: 'map-series' })
    const { rerender } = renderHook(
      ({ visibleSegmentUIDs }: { visibleSegmentUIDs: Set<string> }) =>
        useActiveSeriesPublisher({
          sessionRef: access.sessionRef,
          seriesInstanceUID: 'slide-series',
          visibleAnnotationGroupUIDs: new Set(),
          visibleSegmentUIDs,
          visibleMappingUIDs: new Set(),
        }),
      { initialProps: { visibleSegmentUIDs: new Set<string>() } },
    )
    expect([...ActiveSeriesService.getActiveSeriesUIDs()]).toEqual([
      'slide-series',
    ])

    rerender({ visibleSegmentUIDs: new Set(['seg']) })

    expect([...ActiveSeriesService.getActiveSeriesUIDs()]).toEqual([
      'seg-series',
      'slide-series',
    ])
  })

  it('clears the active series on unmount', () => {
    const { access } = createTestSession()
    const { unmount } = renderHook(() =>
      useActiveSeriesPublisher({
        sessionRef: access.sessionRef,
        seriesInstanceUID: 'slide-series',
        visibleAnnotationGroupUIDs: new Set(),
        visibleSegmentUIDs: new Set(),
        visibleMappingUIDs: new Set(),
      }),
    )

    unmount()

    expect(ActiveSeriesService.getActiveSeriesUIDs().size).toBe(0)
  })
})

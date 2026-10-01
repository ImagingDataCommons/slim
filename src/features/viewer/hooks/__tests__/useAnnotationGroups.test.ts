import { act, renderHook } from '@testing-library/react'

import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession, type TestSession } from '../../testing/fixtures'
import { useAnnotationGroups } from '../useAnnotationGroups'

jest.mock(
  'dicom-microscopy-viewer',
  () =>
    jest.requireActual<typeof import('../../testing/fakeDmv')>(
      '../../testing/fakeDmv',
    ).fakeDmvModule,
)
jest.mock('../../../../utils/logger')

function setup(): TestSession & {
  result: { current: ReturnType<typeof useAnnotationGroups> }
} {
  const test = createTestSession()
  const referencedSeriesInstanceUID = test.session.slide.seriesInstanceUIDs[0]
  for (const [uid, seriesInstanceUID] of [
    ['nuclei', 'ann'],
    ['cells', 'ann'],
    ['other', 'ann-2'],
  ]) {
    test.viewer.annotationGroups.add({
      uid,
      seriesInstanceUID,
      referencedSeriesInstanceUID,
    })
  }
  const { result } = renderHook(() =>
    useAnnotationGroups(test.access, test.session.slide),
  )
  return { ...test, result }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('useAnnotationGroups', () => {
  it('shows every group of a series opened by URL', () => {
    const { result, session, viewer } = setup()

    act(() => {
      result.current.showSeries(session, 'ann')
    })

    expect([...result.current.visibleUIDs]).toEqual(['nuclei', 'cells'])
    expect([...viewer.annotationGroups.visible]).toEqual(['nuclei', 'cells'])
  })

  it('applies a batch of visibility changes', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.onVisibilityChanges([
        { uid: 'nuclei', isVisible: true },
        { uid: 'cells', isVisible: true },
      ])
    })
    act(() => {
      result.current.onVisibilityChange({
        annotationGroupUID: 'nuclei',
        isVisible: false,
      })
    })

    expect([...result.current.visibleUIDs]).toEqual(['cells'])
    expect([...viewer.annotationGroups.visible]).toEqual(['cells'])
  })

  it('keeps the groups shown before a failing one', () => {
    const { result, viewer } = setup()
    viewer.showAnnotationGroup.mockImplementation((uid: string) => {
      if (uid === 'cells') throw new Error('broken')
      viewer.annotationGroups.show(uid)
    })

    let error: unknown
    act(() => {
      try {
        result.current.onVisibilityChanges([
          { uid: 'nuclei', isVisible: true },
          { uid: 'cells', isVisible: true },
        ])
      } catch (thrown) {
        error = thrown
      }
    })

    expect(error).toEqual(new Error('broken'))
    expect([...result.current.visibleUIDs]).toEqual(['nuclei'])
  })

  it('switching series hides the shown groups', () => {
    const { result, viewer } = setup()
    act(() => {
      result.current.onVisibilityChange({
        annotationGroupUID: 'nuclei',
        isVisible: true,
      })
    })

    act(() => {
      result.current.onSeriesChange('ann-2')
    })

    expect(result.current.selectedSeriesUID).toBe('ann-2')
    expect(result.current.visibleUIDs.size).toBe(0)
    expect(viewer.annotationGroups.visible.size).toBe(0)

    act(() => {
      result.current.reset()
    })
    expect(result.current.selectedSeriesUID).toBeUndefined()
  })

  it('restyles a group and refreshes the panels', () => {
    const { result, viewer, access } = setup()

    act(() => {
      result.current.onStyleChange({
        uid: 'nuclei',
        styleOptions: { opacity: 0.2 },
      })
    })

    expect(viewer.getAnnotationGroupStyle('nuclei').opacity).toBe(0.2)
    expect(access.refreshSnapshot).toHaveBeenCalled()
  })

  it('pushes clustering changes to the viewer', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.onDisplaySettingsChange({
        clusteringEnabled: false,
        clusteringThreshold: '',
      })
    })

    expect(result.current.clustering).toEqual({
      isEnabled: false,
      thresholdInput: '',
    })
    expect(viewer.setAnnotationOptions).toHaveBeenCalledWith({
      clusteringPixelSizeThreshold: undefined,
    })
  })
})

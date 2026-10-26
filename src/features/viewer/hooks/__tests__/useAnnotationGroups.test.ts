import { act, renderHook } from '@testing-library/react'

import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession, type TestSession } from '../../testing/fixtures'
import { useAnnotationGroups } from '../useAnnotationGroups'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

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

  it('switching series hides groups the panel has not caught up with', () => {
    const { result, viewer } = setup()
    viewer.showAnnotationGroup('cells')

    act(() => {
      result.current.onSeriesChange('ann-2')
    })

    expect(viewer.hideAnnotationGroup).toHaveBeenCalledWith('cells')
    expect(viewer.annotationGroups.visible.size).toBe(0)
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

  it('applies quick clustering toggles on top of each other', () => {
    const { result, viewer } = setup()
    const on = { clusteringEnabled: true, clusteringThreshold: '' }
    const off = { clusteringEnabled: false, clusteringThreshold: '' }

    act(() => {
      result.current.onDisplaySettingsChange(off, on)
      result.current.onDisplaySettingsChange(on, off)
    })

    expect(result.current.clustering.isEnabled).toBe(true)
    expect(viewer.setAnnotationOptions).toHaveBeenCalledTimes(2)
  })

  it('remembers the chosen fill, which the viewer does not report', () => {
    const { result } = setup()
    const styles = { nuclei: { opacity: 1, color: [255, 0, 0] } }
    expect(result.current.withFillStyles(styles)).toBe(styles)

    act(() => {
      result.current.onStyleChange({
        uid: 'nuclei',
        styleOptions: { fill: true, fillOpacity: 0.3 },
      })
    })
    expect(result.current.withFillStyles(styles).nuclei).toEqual({
      opacity: 1,
      color: [255, 0, 0],
      fill: true,
      fillOpacity: 0.3,
    })

    act(() => {
      result.current.reset()
    })
    expect(result.current.withFillStyles(styles)).toBe(styles)
  })
})

import { act, renderHook } from '@testing-library/react'
import * as dmv from 'dicom-microscopy-viewer'

import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession } from '../../testing/fixtures'
import { useHoveredRoiTooltip } from '../useHoveredRoiTooltip'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

function addRoi(
  viewer: dmv.viewer.VolumeImageViewer,
  uid: string,
): dmv.roi.ROI {
  const roi = new dmv.roi.ROI({
    uid,
    scoord3d: new dmv.scoord3d.Point({
      coordinates: [1, 2, 0],
      frameOfReferenceUID: 'for',
    }),
  })
  viewer.addROI(roi, {})
  return roi
}

function pointerMove(rois: dmv.roi.ROI[], x = 10, y = 20) {
  return {
    features: rois.map((feature) => ({ feature, annotationGroupUID: null })),
    event: {
      originalEvent: new MouseEvent('pointermove', { clientX: x, clientY: y }),
    },
  }
}

function setup(visibleRoiUIDs: string[]) {
  const { session, access } = createTestSession()
  const first = addRoi(session.volumeViewer, 'roi-a')
  const second = addRoi(session.volumeViewer, 'roi-b')
  const hook = renderHook(() =>
    useHoveredRoiTooltip({
      sessionRef: access.sessionRef,
      visibleRoiUIDs: new Set(visibleRoiUIDs),
      visibleAnnotationGroupUIDs: new Set(),
      describeSeries: () => 'series',
    }),
  )
  return { ...hook, first, second }
}

beforeEach(() => {
  resetFakeDmv()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useHoveredRoiTooltip', () => {
  it('describes the visible ROIs under the pointer', () => {
    const { result, second } = setup(['roi-b'])

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_pointer_move(
        pointerMove([second]),
      )
    })

    expect(result.current.store.getSnapshot()).toEqual({
      isVisible: true,
      x: 10,
      y: 20,
      rois: [
        { index: 2, roiUid: 'roi-b', attributes: [], seriesDescription: '' },
      ],
    })
  })

  it('stays hidden over ROIs that are not shown', () => {
    const { result, first } = setup(['roi-b'])

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_pointer_move(
        pointerMove([first]),
      )
    })

    expect(result.current.store.getSnapshot().isVisible).toBe(false)
  })

  it('follows the pointer and hides when it leaves', () => {
    const { result, second } = setup(['roi-b'])
    const move = result.current.dmvHandlers.dicommicroscopyviewer_pointer_move

    act(() => {
      move(pointerMove([second], 10, 20))
      vi.runAllTimers()
      move(pointerMove([second], 30, 40))
      vi.runAllTimers()
    })
    expect(result.current.store.getSnapshot()).toMatchObject({
      isVisible: true,
      x: 30,
      y: 40,
    })

    act(() => {
      move(pointerMove([]))
      vi.runAllTimers()
    })
    expect(result.current.store.getSnapshot().isVisible).toBe(false)
  })

  it('reset hides the tooltip', () => {
    const { result, second } = setup(['roi-b'])
    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_pointer_move(
        pointerMove([second]),
      )
      result.current.reset()
    })

    expect(result.current.store.getSnapshot().isVisible).toBe(false)
  })

  it('drops a pending pointer move on unmount', () => {
    const { result, unmount, first, second } = setup(['roi-a', 'roi-b'])
    const move = result.current.dmvHandlers.dicommicroscopyviewer_pointer_move
    const { store } = result.current

    act(() => {
      move(pointerMove([first]))
      move(pointerMove([second]))
    })
    unmount()
    vi.runAllTimers()

    expect(store.getSnapshot().rois.map((roi) => roi.roiUid)).toEqual(['roi-a'])
  })
})

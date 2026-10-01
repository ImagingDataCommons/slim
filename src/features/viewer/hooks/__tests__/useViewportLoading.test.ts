import { act, renderHook } from '@testing-library/react'

import { StorageClasses } from '../../../../data/uids'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession } from '../../testing/fixtures'
import { useViewportLoading } from '../useViewportLoading'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

const frame = (frameNumber: number) => ({
  studyInstanceUID: 'study',
  seriesInstanceUID: 'series',
  sopInstanceUID: 'image',
  sopClassUID: StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE,
  frameNumber,
  channelIdentifier: '1',
})

beforeEach(() => {
  resetFakeDmv()
})

describe('useViewportLoading', () => {
  it('waits for the first image until all requested frames settle', () => {
    const { session, access } = createTestSession()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))
    expect(result.current).toMatchObject({
      isLoading: false,
      isWaitingForFirstImage: true,
    })

    act(() => {
      const handlers = result.current.dmvHandlers
      handlers.dicommicroscopyviewer_loading_started(null)
      handlers.dicommicroscopyviewer_frame_loading_started(frame(1))
      handlers.dicommicroscopyviewer_frame_loading_started(frame(2))
      handlers.dicommicroscopyviewer_frame_loading_ended({
        ...frame(1),
        pixelArray: new Uint8Array([1, 2]),
      })
    })
    expect(result.current).toMatchObject({
      isLoading: true,
      isWaitingForFirstImage: true,
    })
    expect([...session.loadingFrames]).toEqual(['image-2'])

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_ended(
        frame(2),
      )
    })
    expect(result.current).toMatchObject({
      isLoading: false,
      isWaitingForFirstImage: false,
    })
    /** Color slides have no per-channel windows to derive */
    expect(session.pixelStatistics.size).toBe(0)
  })

  it('stops waiting when loading fails and waits again after a reset', () => {
    const { access } = createTestSession()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_loading_error(null)
    })
    expect(result.current.isWaitingForFirstImage).toBe(false)

    act(() => {
      result.current.reset()
    })
    expect(result.current.isWaitingForFirstImage).toBe(true)
  })

  it('ignores frame events without a session', () => {
    const { result } = renderHook(() =>
      useViewportLoading({ current: undefined }),
    )

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_started(
        frame(1),
      )
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_ended(
        frame(1),
      )
    })

    expect(result.current.isWaitingForFirstImage).toBe(true)
  })
})

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

/** Volume image of createTestSlide(); its label image ends in `.2` */
const VOLUME_UID = '2.25.900000000000000000000000000000000000002.1'

const frame = (frameNumber: number, sopInstanceUID = VOLUME_UID) => ({
  studyInstanceUID: 'study',
  seriesInstanceUID: 'series',
  sopInstanceUID,
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
    expect([...session.loadingFrames]).toEqual([`${VOLUME_UID}-2`])

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

  it('ignores frames of the label viewer and study thumbnails', () => {
    const { session, access } = createTestSession()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))

    act(() => {
      const handlers = result.current.dmvHandlers
      handlers.dicommicroscopyviewer_frame_loading_started(frame(1))
      handlers.dicommicroscopyviewer_frame_loading_started(
        frame(1, 'thumbnail-of-another-slide'),
      )
      handlers.dicommicroscopyviewer_frame_loading_ended({
        ...frame(1, '2.25.900000000000000000000000000000000000002.2'),
        pixelArray: new Uint8Array([1, 2]),
      })
    })

    expect([...session.loadingFrames]).toEqual([`${VOLUME_UID}-1`])
    expect(result.current.isWaitingForFirstImage).toBe(true)
  })

  it('stops waiting when loading fails and waits again after a reset', () => {
    const { session, access } = createTestSession()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_loading_error(null)
    })
    expect(result.current.isWaitingForFirstImage).toBe(false)

    act(() => {
      result.current.reset(session)
    })
    expect(result.current.isWaitingForFirstImage).toBe(true)
  })

  it('keeps "Updating colors" from an ICC toggle until the swap is drawn', async () => {
    const { session, access } = createTestSession()
    const map = session.volumeViewer.getMap()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))
    let finishSwap: () => void = () => {}
    const swap = new Promise<void>((resolve) => {
      finishSwap = resolve
    })
    act(() => {
      result.current.reset(session)
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_started(
        frame(1),
      )
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_ended(
        frame(1),
      )
      result.current.colorProfileToggled(swap)
    })
    expect(result.current.isUpdatingColors).toBe(true)
    expect(result.current.statusLabel).toBe('Updating colors')

    await act(async () => {
      finishSwap()
      await swap
    })
    const onRenderComplete = vi
      .mocked(map.on)
      .mock.calls.findLast(
        ([type]) => String(type) === 'rendercomplete',
      )?.[1] as (() => void) | undefined
    act(() => {
      onRenderComplete?.()
    })
    expect(result.current.isUpdatingColors).toBe(false)
    expect(result.current.statusLabel).toBeUndefined()
  })

  it('ignores the swap of an earlier toggle that settles late', async () => {
    const { session, access } = createTestSession()
    const map = session.volumeViewer.getMap()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))
    let finishFirstSwap: () => void = () => {}
    const firstSwap = new Promise<void>((resolve) => {
      finishFirstSwap = resolve
    })
    const secondSwap = new Promise<void>(() => {})
    act(() => {
      result.current.reset(session)
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_started(
        frame(1),
      )
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_ended(
        frame(1),
      )
      result.current.colorProfileToggled(firstSwap)
      /** Another slide, then a new toggle before the first swap settles */
      result.current.reset(session)
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_started(
        frame(1),
      )
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_ended(
        frame(1),
      )
      result.current.colorProfileToggled(secondSwap)
    })
    const renderListeners = (): number =>
      vi
        .mocked(map.on)
        .mock.calls.filter(([type]) => String(type) === 'rendercomplete').length
    const listenersBefore = renderListeners()

    await act(async () => {
      finishFirstSwap()
      await firstSwap
    })
    /** Still waiting for the second swap: no redraw was awaited yet */
    expect(renderListeners()).toBe(listenersBefore)
    expect(result.current.isUpdatingColors).toBe(true)
  })

  it('announces the color profile until the map has drawn the corrected tiles', () => {
    const { session, access } = createTestSession()
    /** A color slide whose image carries an ICC profile */
    Object.assign(session.slide, { areVolumeImagesMonochrome: false })
    Object.assign(session.slide.volumeImages[0], {
      OpticalPathSequence: [{ ICCProfile: 'profile' }],
    })
    const map = session.volumeViewer.getMap()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))
    const handlers = () => result.current.dmvHandlers
    act(() => {
      result.current.reset(session)
      handlers().dicommicroscopyviewer_frame_loading_started(frame(1))
      handlers().dicommicroscopyviewer_frame_loading_ended(frame(1))
    })
    expect(result.current.statusLabel).toBe('Applying color profile')

    vi.spyOn(session.volumeViewer, 'getICCProfiles').mockReturnValue([{}])
    act(() => {
      handlers().dicommicroscopyviewer_frame_loading_started(frame(2))
      handlers().dicommicroscopyviewer_frame_loading_ended(frame(2))
    })
    /** Loaded, but decoded, corrected and drawn only later */
    expect(result.current.statusLabel).toBe('Applying color profile')
    /** A frame is requested so an already finished map reports again */
    expect(map.render).toHaveBeenCalled()

    const onRenderComplete = vi
      .mocked(map.on)
      .mock.calls.find(([type]) => String(type) === 'rendercomplete')?.[1] as
      | (() => void)
      | undefined
    act(() => {
      onRenderComplete?.()
    })
    expect(result.current.statusLabel).toBeUndefined()
  })

  it('announces segment frames at the bottom while they load', () => {
    const { access } = createTestSession()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))
    const segFrame = (frameNumber: number) => ({
      ...frame(frameNumber, 'seg-instance'),
      sopClassUID: StorageClasses.LABELMAP_SEGMENTATION,
    })

    act(() => {
      const handlers = result.current.dmvHandlers
      handlers.dicommicroscopyviewer_frame_loading_started(segFrame(1))
      handlers.dicommicroscopyviewer_frame_loading_started(segFrame(2))
      handlers.dicommicroscopyviewer_frame_loading_ended(segFrame(1))
    })
    expect(result.current.isLoadingOverlays).toBe(true)
    expect(result.current.overlayStatus).toEqual({
      label: 'Loading segments',
      progress: '1 of 2 frames',
    })
    /** Overlay frames do not hold the slide's own loading state */
    expect(result.current.isLoading).toBe(false)

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_ended(
        segFrame(2),
      )
    })
    expect(result.current.isLoadingOverlays).toBe(false)
    expect(result.current.overlayStatus).toBeUndefined()
  })

  it('names overlays of several kinds together, and bulk annotations', () => {
    const { session, access } = createTestSession()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))

    act(() => {
      const handlers = result.current.dmvHandlers
      handlers.dicommicroscopyviewer_loading_started(null)
    })
    expect(result.current.overlayStatus?.label).toBe('Loading annotations')

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_started({
        ...frame(1, 'pm-instance'),
        sopClassUID: StorageClasses.PARAMETRIC_MAP,
      })
    })
    expect(result.current.overlayStatus?.label).toBe('Loading overlays')

    /** A new slide drops what the previous one was loading */
    act(() => {
      result.current.reset(session)
    })
    expect(result.current.overlayStatus).toBeUndefined()
  })

  it('stops announcing overlay loads that never report their end', () => {
    vi.useFakeTimers()
    const { access } = createTestSession()
    const { result } = renderHook(() => useViewportLoading(access.sessionRef))

    act(() => {
      result.current.dmvHandlers.dicommicroscopyviewer_frame_loading_started({
        ...frame(1, 'seg-instance'),
        sopClassUID: StorageClasses.SEGMENTATION,
      })
    })
    expect(result.current.isLoadingOverlays).toBe(true)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.isLoadingOverlays).toBe(false)
    vi.useRealTimers()
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

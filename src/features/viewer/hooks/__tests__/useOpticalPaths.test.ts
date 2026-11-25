import { act, renderHook } from '@testing-library/react'

import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession, type TestSession } from '../../testing/fixtures'
import { useOpticalPaths } from '../useOpticalPaths'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

function setup(viewerGamma = true): TestSession & {
  result: { current: ReturnType<typeof useOpticalPaths> }
} {
  const test = createTestSession()
  const { result } = renderHook(() => useOpticalPaths(test.access, viewerGamma))
  return { ...test, result }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('useOpticalPaths', () => {
  it('shows and activates the default optical paths', () => {
    const { result, session, viewer, access } = setup()

    act(() => {
      result.current.showDefault(session)
    })

    expect([...result.current.visibleIdentifiers]).toEqual(['1'])
    expect([...result.current.activeIdentifiers]).toEqual(['1'])
    expect(viewer.isOpticalPathVisible('1')).toBe(true)
    expect(access.refreshSnapshot).toHaveBeenCalled()
  })

  it('windows every sampled channel on Reset, also the hidden ones', () => {
    const { result, session, viewer } = setup()
    viewer.opticalPaths.splice(0, 1, {
      identifier: 'dapi',
      isMonochromatic: true,
      seriesInstanceUID: 's',
    })
    viewer.opticalPaths.push({
      identifier: 'fitc',
      isMonochromatic: true,
      seriesInstanceUID: 's',
    })
    session.pixelStatistics.set('dapi', {
      min: 3,
      max: 400,
      numFramesSampled: 4,
    })
    session.pixelStatistics.set('fitc', {
      min: 10,
      max: 900,
      numFramesSampled: 4,
    })

    act(() => {
      result.current.showDefault(session)
    })

    expect(viewer.getOpticalPathStyle('dapi').limitValues).toEqual([3, 400])
    expect(viewer.isOpticalPathVisible('fitc')).toBe(false)
    expect(viewer.getOpticalPathStyle('fitc').limitValues).toEqual([10, 900])
  })

  it('shows the first monochrome path in white when none has a palette', () => {
    const { result, session, viewer } = setup()
    viewer.opticalPaths.splice(0, 1, {
      identifier: 'dapi',
      isMonochromatic: true,
      seriesInstanceUID: 's',
    })
    viewer.opticalPaths.push({
      identifier: 'fitc',
      isMonochromatic: true,
      seriesInstanceUID: 's',
    })

    act(() => {
      result.current.showDefault(session)
    })

    expect([...result.current.visibleIdentifiers]).toEqual(['dapi'])
    expect(viewer.getOpticalPathStyle('dapi').color).toEqual([255, 255, 255])
    expect(viewer.isOpticalPathVisible('fitc')).toBe(false)
  })

  it('shows the paths of a series opened by URL', () => {
    const { result, session } = setup()
    const [seriesInstanceUID] = session.slide.seriesInstanceUIDs

    act(() => {
      result.current.showSeries(session, seriesInstanceUID)
    })

    expect([...result.current.visibleIdentifiers]).toEqual(['1'])
  })

  it('toggles visibility and activity of single paths', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.onVisibilityChange({
        opticalPathIdentifier: '1',
        isVisible: true,
      })
      result.current.onActivityChange({
        opticalPathIdentifier: '1',
        isActive: true,
      })
    })
    expect([...result.current.visibleIdentifiers]).toEqual(['1'])
    expect(viewer.isOpticalPathActive('1')).toBe(true)

    act(() => {
      result.current.onVisibilityChange({
        opticalPathIdentifier: '1',
        isVisible: false,
      })
      result.current.onActivityChange({
        opticalPathIdentifier: '1',
        isActive: false,
      })
    })
    expect(result.current.visibleIdentifiers.size).toBe(0)
    expect(result.current.activeIdentifiers.size).toBe(0)
  })

  it('restyles a path and refreshes the panels', () => {
    const { result, viewer, access } = setup()

    act(() => {
      result.current.onStyleChange({
        opticalPathIdentifier: '1',
        styleOptions: { opacity: 0.5 },
      })
    })

    expect(viewer.getOpticalPathStyle('1').opacity).toBe(0.5)
    expect(access.refreshSnapshot).toHaveBeenCalled()
  })

  it('previews a style on the slide without refreshing the snapshot', () => {
    const { result, viewer, access, session } = setup()

    act(() => {
      result.current.onStylePreview({
        opticalPathIdentifier: '1',
        styleOptions: { opacity: 0.25 },
      })
    })

    expect(viewer.getOpticalPathStyle('1').opacity).toBe(0.25)
    expect(access.refreshSnapshot).not.toHaveBeenCalled()
    expect(session.hasUserDisplayChanges).toBe(true)
  })

  it('remembers windows the user set and whether a presentation state is shown', () => {
    const { result, session } = setup()

    act(() => {
      result.current.onStylePreview({
        opticalPathIdentifier: '1',
        styleOptions: { opacity: 0.5 },
      })
    })
    /** Opacity alone is not a window */
    expect(session.userWindowedOpticalPaths.has('1')).toBe(false)

    act(() => {
      result.current.onStyleChange({
        opticalPathIdentifier: '1',
        styleOptions: { limitValues: [10, 200] },
      })
      result.current.showPresentationState(session, {
        SOPInstanceUID: '1.2.3',
        AdvancedBlendingSequence: [],
      } as never)
    })
    expect(session.userWindowedOpticalPaths.has('1')).toBe(true)
    expect(session.isPresentationStateShown).toBe(true)

    /** The default display (Reset) lets first frames set windows again */
    act(() => {
      result.current.showDefault(session)
    })
    expect(session.userWindowedOpticalPaths.size).toBe(0)
    expect(session.isPresentationStateShown).toBe(false)
  })

  it('follows the viewer gamma until the user picks one', () => {
    const { result, viewer } = setup(true)
    expect(result.current.displaySettings).toEqual({
      iccProfileEnabled: true,
      gammaEnabled: true,
    })
    expect(result.current.gammaCorrection).toBeUndefined()

    act(() => {
      result.current.onDisplaySettingsChange({
        iccProfileEnabled: true,
        gammaEnabled: false,
      })
    })

    expect(result.current.gammaCorrection).toBe(false)
    expect(result.current.displaySettings.gammaEnabled).toBe(false)
    expect(viewer.getPaletteDisplayGammaCorrectionEnabled()).toBe(false)
    expect(viewer.toggleICCProfiles).not.toHaveBeenCalled()
  })

  it('toggles ICC profiles and re-enables them for new viewers', async () => {
    const { result, viewer } = setup()

    await act(async () => {
      await result.current.onDisplaySettingsChange({
        iccProfileEnabled: false,
        gammaEnabled: true,
      })
    })
    expect(result.current.displaySettings.iccProfileEnabled).toBe(false)
    expect(viewer.toggleICCProfiles).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.reset()
    })
    expect(result.current.displaySettings.iccProfileEnabled).toBe(true)
  })

  it('shows the ICC state DMV kept when a toggle fails', async () => {
    const { result, viewer } = setup()
    /** DMV reports the failure and resolves without changing its state */
    viewer.toggleICCProfiles.mockReturnValueOnce(Promise.resolve())

    let swap: PromiseLike<unknown> | undefined
    act(() => {
      swap = result.current.onDisplaySettingsChange({
        iccProfileEnabled: false,
        gammaEnabled: true,
      })
    })
    /** The switch follows the click while the loaders are swapped */
    expect(result.current.displaySettings.iccProfileEnabled).toBe(false)

    await act(async () => {
      await swap
    })
    expect(result.current.displaySettings.iccProfileEnabled).toBe(true)
  })

  it('ignores a toggle that settles after the slide changed', async () => {
    const { result, viewer, access } = setup()
    let swapLoaders = (): void => {}
    viewer.toggleICCProfiles.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        swapLoaders = resolve
      }),
    )

    let swap: PromiseLike<unknown> | undefined
    act(() => {
      swap = result.current.onDisplaySettingsChange({
        iccProfileEnabled: false,
        gammaEnabled: true,
      })
    })
    act(() => {
      /** The next slide's session replaces this one */
      Object.assign(access.sessionRef, { current: undefined })
      result.current.reset()
    })

    await act(async () => {
      swapLoaders()
      await swap
    })
    expect(viewer.isICCProfilesEnabled).not.toHaveBeenCalled()
    expect(result.current.displaySettings.iccProfileEnabled).toBe(true)
  })
})

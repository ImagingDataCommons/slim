import { act, renderHook } from '@testing-library/react'

import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession, type TestSession } from '../../testing/fixtures'
import { useOpticalPaths } from '../useOpticalPaths'

jest.mock(
  'dicom-microscopy-viewer',
  () =>
    jest.requireActual<typeof import('../../testing/fakeDmv')>(
      '../../testing/fakeDmv',
    ).fakeDmvModule,
)
jest.mock('../../../../utils/logger')

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

  it('toggles ICC profiles and re-enables them for new viewers', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.onDisplaySettingsChange({
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
})

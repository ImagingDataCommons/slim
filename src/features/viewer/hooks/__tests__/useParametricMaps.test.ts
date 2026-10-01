import { act, renderHook } from '@testing-library/react'

import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession, type TestSession } from '../../testing/fixtures'
import { useParametricMaps } from '../useParametricMaps'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

function setup(): TestSession & {
  result: { current: ReturnType<typeof useParametricMaps> }
} {
  const test = createTestSession()
  test.viewer.mappings.add({ uid: 'ki67', seriesInstanceUID: 'pm' })
  test.viewer.mappings.add({ uid: 'cd3', seriesInstanceUID: 'pm' })
  test.viewer.mappings.add({ uid: 'other', seriesInstanceUID: 'pm-2' })
  const { result } = renderHook(() => useParametricMaps(test.access))
  return { ...test, result }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('useParametricMaps', () => {
  it('shows every mapping of a series opened by URL', () => {
    const { result, session, viewer } = setup()

    act(() => {
      result.current.showSeries(session, 'pm')
    })

    expect([...result.current.visibleUIDs]).toEqual(['ki67', 'cd3'])
    expect([...viewer.mappings.visible]).toEqual(['ki67', 'cd3'])
  })

  it('keeps showing the other mappings when one fails', () => {
    const { result, session, viewer } = setup()
    viewer.showParameterMapping.mockImplementationOnce(() => {
      throw new Error('broken')
    })

    act(() => {
      result.current.showSeries(session, 'pm')
    })

    expect([...result.current.visibleUIDs]).toEqual(['cd3'])
  })

  it('shows, hides and restyles single mappings', () => {
    const { result, viewer, access } = setup()

    act(() => {
      result.current.onVisibilityChange({ mappingUID: 'ki67', isVisible: true })
    })
    expect([...result.current.visibleUIDs]).toEqual(['ki67'])

    act(() => {
      result.current.onVisibilityChange({
        mappingUID: 'ki67',
        isVisible: false,
      })
      result.current.onStyleChange({
        mappingUID: 'ki67',
        styleOptions: { opacity: 0.4 },
      })
    })
    expect(result.current.visibleUIDs.size).toBe(0)
    expect(viewer.getParameterMappingStyle('ki67').opacity).toBe(0.4)
    expect(access.refreshSnapshot).toHaveBeenCalled()
  })

  it('mirrors legend visibility changes and resets for new viewers', () => {
    const { result, viewer } = setup()
    const handler =
      result.current.dmvHandlers
        .dicommicroscopyviewer_parameter_mapping_visibility_changed

    act(() => {
      handler({ mappingUID: 'cd3', isVisible: true })
    })
    expect([...result.current.visibleUIDs]).toEqual(['cd3'])
    expect(viewer.showParameterMapping).not.toHaveBeenCalled()

    act(() => {
      result.current.reset()
    })
    expect(result.current.visibleUIDs.size).toBe(0)
  })

  it('toggles interpolation in the viewer', () => {
    const { result, viewer } = setup()

    act(() => {
      result.current.onDisplaySettingsChange({ interpolationEnabled: false })
    })

    expect(result.current.isInterpolationEnabled).toBe(false)
    expect(viewer.toggleParametricMapInterpolation).toHaveBeenCalledTimes(1)
  })
})

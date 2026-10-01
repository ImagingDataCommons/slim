import { act, renderHook } from '@testing-library/react'
import {
  EMPTY_VIEWER_SNAPSHOT,
  readViewerSnapshot,
  type ViewerSnapshot,
} from '../../services/viewerSnapshot'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession, type TestSession } from '../../testing/fixtures'
import { useSegmentations } from '../useSegmentations'

jest.mock(
  'dicom-microscopy-viewer',
  () =>
    jest.requireActual<typeof import('../../testing/fakeDmv')>(
      '../../testing/fakeDmv',
    ).fakeDmvModule,
)
jest.mock('../../../../utils/logger')

const RED_LAB = [34885, 53485, 50171]

function createSegmentedSession(): TestSession {
  const test = createTestSession()
  const { segments } = test.viewer
  const binaryMetadata = {
    SeriesInstanceUID: 'seg-series',
    SegmentationType: 'BINARY',
    SegmentSequence: [
      { SegmentNumber: 1, RecommendedDisplayCIELabValue: RED_LAB },
      { SegmentNumber: 2, RecommendedDisplayCIELabValue: RED_LAB },
      { SegmentNumber: 3, RecommendedDisplayCIELabValue: RED_LAB },
    ],
  }
  segments.add({ uid: 'tumor', seriesInstanceUID: 'seg-series', number: 1 }, [
    binaryMetadata,
  ])
  segments.add(
    {
      uid: 'background',
      seriesInstanceUID: 'seg-series',
      number: 2,
      isBackground: true,
    },
    [binaryMetadata],
  )
  segments.add(
    {
      uid: 'absent',
      seriesInstanceUID: 'seg-series',
      number: 3,
      isAbsent: true,
    },
    [binaryMetadata],
  )
  segments.add(
    { uid: 'fraction', seriesInstanceUID: 'frac-series', number: 1 },
    [{ SeriesInstanceUID: 'frac-series', SegmentationType: 'FRACTIONAL' }],
  )
  return test
}

function renderSegmentations(test: TestSession) {
  let snapshot = readViewerSnapshot(test.session, EMPTY_VIEWER_SNAPSHOT)
  const hook = renderHook(
    ({
      current,
      isGammaCorrectionEnabled,
    }: {
      current: ViewerSnapshot
      isGammaCorrectionEnabled: boolean
    }) =>
      useSegmentations(test.access, {
        snapshot: current,
        isGammaCorrectionEnabled,
      }),
    { initialProps: { current: snapshot, isGammaCorrectionEnabled: true } },
  )
  const refresh = (isGammaCorrectionEnabled = true): void => {
    snapshot = readViewerSnapshot(test.session, snapshot)
    hook.rerender({ current: snapshot, isGammaCorrectionEnabled })
  }
  return { ...hook, refresh }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('useSegmentations palettes', () => {
  it('draws every BINARY segment through its recommended color', () => {
    const test = createSegmentedSession()
    renderSegmentations(test)

    const styled = test.viewer.setSegmentStyle.mock.calls.map(([uid]) => uid)
    expect(styled).toEqual(['tumor', 'background', 'absent'])
    expect(test.viewer.getSegmentStyle('tumor')).toMatchObject({
      opacity: 1,
      paletteColorLookupTable: {
        options: { firstValueMapped: 0, applyDisplayGammaCorrection: true },
      },
    })
  })

  it('does not rebuild palettes when segments and metadata are unchanged', () => {
    const test = createSegmentedSession()
    const { refresh } = renderSegmentations(test)
    test.viewer.setSegmentStyle.mockClear()

    refresh()

    expect(test.viewer.setSegmentStyle).not.toHaveBeenCalled()
  })

  it('rebuilds palettes when the gamma setting changes', () => {
    const test = createSegmentedSession()
    const { refresh } = renderSegmentations(test)
    test.viewer.setSegmentStyle.mockClear()

    refresh(false)

    expect(test.viewer.setSegmentStyle).toHaveBeenCalledTimes(3)
    expect(test.viewer.getSegmentStyle('tumor')).toMatchObject({
      paletteColorLookupTable: {
        options: { applyDisplayGammaCorrection: false },
      },
    })
  })

  it('keeps a customized color and the panel shows it', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)

    act(() => {
      result.current.onStyleChange({
        segmentUID: 'tumor',
        styleOptions: { color: [0, 0, 255] },
      })
    })

    expect(test.access.refreshSnapshot).toHaveBeenCalled()
    expect(result.current.panelStyles.tumor.color).toEqual([0, 0, 255])
    expect(test.viewer.getSegmentStyle('tumor')).toMatchObject({
      paletteColorLookupTable: {
        options: {
          data: [
            [0, 0, 0],
            [0, 0, 255],
          ],
        },
      },
    })
  })

  it('changes only the opacity when no color is given', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)
    test.viewer.setSegmentStyle.mockClear()

    act(() => {
      result.current.onStyleChange({
        segmentUID: 'fraction',
        styleOptions: { opacity: 0.3 },
      })
    })

    expect(test.viewer.setSegmentStyle).toHaveBeenCalledWith('fraction', {
      opacity: 0.3,
    })
  })

  it('lists FRACTIONAL segments by palette instead of color', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)

    expect(result.current.panelStyles.fraction).toEqual({
      opacity: 1,
      color: undefined,
      paletteColorLookupTable: undefined,
    })
    expect(result.current.panelStyles.tumor.color).toHaveLength(3)
  })
})

describe('useSegmentations visibility', () => {
  it('shows the present foreground segments of a series opened by URL', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)

    act(() => {
      result.current.showSeries(test.session, 'seg-series')
    })

    expect([...result.current.visibleUIDs]).toEqual(['tumor'])
    expect([...test.viewer.segments.visible]).toEqual(['tumor'])
  })

  it('toggles segments but ignores absent ones', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)

    act(() => {
      result.current.onVisibilityChange({
        segmentUID: 'absent',
        isVisible: true,
      })
      result.current.onVisibilityChange({
        segmentUID: 'tumor',
        isVisible: true,
      })
    })
    expect([...result.current.visibleUIDs]).toEqual(['tumor'])

    act(() => {
      result.current.onVisibilityChange({
        segmentUID: 'tumor',
        isVisible: false,
      })
    })
    expect(result.current.visibleUIDs.size).toBe(0)
    expect(test.viewer.hideSegment).toHaveBeenCalledWith('tumor')
  })

  it('switching series hides the shown segments and shows the new ones', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)
    act(() => {
      result.current.onVisibilityChange({
        segmentUID: 'tumor',
        isVisible: true,
      })
    })

    act(() => {
      result.current.onSeriesChange('frac-series')
    })

    expect(result.current.selectedSeriesUID).toBe('frac-series')
    expect([...result.current.visibleUIDs]).toEqual(['fraction'])
    expect([...test.viewer.segments.visible]).toEqual(['fraction'])
  })

  it('mirrors visibility changes made in the viewport legend', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)
    const handler =
      result.current.dmvHandlers
        .dicommicroscopyviewer_segment_visibility_changed

    act(() => {
      handler({ segmentUID: 'tumor', isVisible: true })
    })
    expect([...result.current.visibleUIDs]).toEqual(['tumor'])
    expect(test.viewer.showSegment).not.toHaveBeenCalled()

    act(() => {
      result.current.reset()
    })
    expect(result.current.visibleUIDs.size).toBe(0)
  })

  it('toggles interpolation only when the setting changes', () => {
    const test = createSegmentedSession()
    const { result } = renderSegmentations(test)

    act(() => {
      result.current.onDisplaySettingsChange({ interpolationEnabled: false })
      result.current.onDisplaySettingsChange({ interpolationEnabled: true })
    })

    expect(result.current.isInterpolationEnabled).toBe(true)
    expect(test.viewer.toggleSegmentationInterpolation).toHaveBeenCalledTimes(1)
  })
})

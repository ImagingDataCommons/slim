import { render } from '@testing-library/react'

import type DicomWebManager from '../../DicomWebManager'
import type { Slide } from '../../data/slides'
import { StorageClasses } from '../../data/uids'
import { logger } from '../../utils/logger'
import SlideItem from '../SlideItem'

const viewer = vi.hoisted(() => ({
  created: 0,
  render: vi.fn(),
  resize: vi.fn(),
  cleanup: vi.fn(),
}))

vi.mock('dicom-microscopy-viewer', () => ({
  viewer: {
    OverviewImageViewer: class {
      constructor() {
        viewer.created += 1
      }
      render = viewer.render
      cleanup = viewer.cleanup
      resize = viewer.resize
    },
  },
}))
vi.mock('../../utils/slideDisplay', () => ({
  getIlluminationType: () => undefined,
  getMagnification: () => undefined,
  getSlideDisplayId: () => 'S-1',
  getSlideStainInfo: () => undefined,
}))
vi.mock('../ValidationWarning', () => ({ default: () => null }))
vi.mock('../../utils/computeOverviewPreviewResizeFactor', () => ({
  computeOverviewPreviewResizeFactor: () => 1,
}))

let resizeCallbacks: ResizeObserverCallback[] = []
class CapturingResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback)
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    resizeCallbacks = []
  }
}

describe('SlideItem', () => {
  beforeEach(() => {
    viewer.created = 0
    viewer.render.mockReset()
    viewer.resize.mockReset()
    viewer.cleanup.mockReset()
    resizeCallbacks = []
    vi.stubGlobal('ResizeObserver', CapturingResizeObserver)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(64)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(64)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stops retrying an overview that cannot be shown', () => {
    viewer.render.mockImplementation(() => {
      throw new Error('no overview')
    })
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const slide = {
      overviewImages: [{ SeriesInstanceUID: 'o1' }],
      thumbnailImages: [],
      seriesInstanceUIDs: ['s1'],
    } as unknown as Slide
    const clients = {
      [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: {} as DicomWebManager,
    }

    render(<SlideItem clients={clients} slide={slide} onSelect={() => {}} />)
    const [onResize] = resizeCallbacks
    expect(() => {
      onResize([], {} as ResizeObserver)
    }).not.toThrow()

    expect(viewer.created).toBe(1)
    expect(viewer.cleanup).toHaveBeenCalled()
    expect(logError).toHaveBeenCalled()
    expect(resizeCallbacks).toEqual([])
  })

  it('keeps an empty thumbnail when the first resize fails', () => {
    viewer.resize.mockImplementation(() => {
      throw new Error('no size')
    })
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {})
    let frame: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback
      return 1
    })
    const slide = {
      overviewImages: [{ SeriesInstanceUID: 'o1' }],
      thumbnailImages: [],
      seriesInstanceUIDs: ['s1'],
    } as unknown as Slide
    const clients = {
      [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: {} as DicomWebManager,
    }

    const { unmount } = render(
      <SlideItem clients={clients} slide={slide} onSelect={() => {}} />,
    )
    resizeCallbacks[0]([], {} as ResizeObserver)
    expect(() => frame?.(0)).not.toThrow()

    expect(viewer.cleanup).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalled()
    unmount()
    expect(viewer.cleanup).toHaveBeenCalledTimes(1)
  })
})

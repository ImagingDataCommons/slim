import type { Mock } from 'vitest'
import {
  clampOverviewMapInViewport,
  observeOverviewMapClamp,
} from '../clampOverviewMapInViewport'

function setSize(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: height,
  })
}

function buildContainer(
  mapWidth = '300px',
  mapHeight = '300px',
): {
  container: HTMLElement
  overview: HTMLElement
  mapEl: HTMLElement
} {
  const container = document.createElement('div')
  const overview = document.createElement('div')
  overview.className = 'ol-overviewmap'
  const mapEl = document.createElement('div')
  mapEl.className = 'ol-overviewmap-map'
  mapEl.style.width = mapWidth
  mapEl.style.height = mapHeight
  overview.appendChild(mapEl)
  container.appendChild(overview)
  setSize(container, 1000, 800)
  return { container, overview, mapEl }
}

interface FakeView {
  getProjection: () => { getExtent: () => number[] }
  getRotation: () => number
  applyOptions_: Mock
  getUpdatedOptions_: (options: Record<string, unknown>) => unknown
}

function buildVolumeViewer(
  rotation = 0,
  size: number[] | undefined = [120, 120],
): { volumeViewer: object; view: FakeView; updateSize: Mock } {
  const view: FakeView = {
    getProjection: () => ({ getExtent: () => [0, 0, 1000, 500] }),
    getRotation: () => rotation,
    applyOptions_: vi.fn(),
    getUpdatedOptions_: (options) => options,
  }
  const updateSize = vi.fn()
  const overviewControl = {
    getOverviewMap: () => ({
      updateSize,
      getView: () => view,
      getSize: () => size,
    }),
  }
  const volumeViewer = {
    [Symbol('unrelated')]: { other: true },
    [Symbol('overview')]: overviewControl,
  }
  return { volumeViewer, view, updateSize }
}

describe('clampOverviewMapInViewport', () => {
  it('fits the mini-map into the overview card and pins the card', () => {
    const { container, overview, mapEl } = buildContainer()
    clampOverviewMapInViewport(container)
    expect(mapEl.style.width).toBe('120px')
    expect(mapEl.style.height).toBe('120px')
    expect(overview.style.right).toBe('14px')
    expect(overview.style.bottom).toBe('14px')
    expect(mapEl.style.padding).toBe('0px')
  })

  it('keeps the slide aspect ratio inside the card width', () => {
    const { container, mapEl } = buildContainer('400px', '100px')
    clampOverviewMapInViewport(container)
    expect(mapEl.style.width).toBe('186px')
    expect(mapEl.style.height).toBe('46.5px')
  })

  it('does nothing without the overview elements', () => {
    const container = document.createElement('div')
    expect(() => clampOverviewMapInViewport(container)).not.toThrow()
  })

  it('leaves an unsized mini-map alone', () => {
    const { container, overview, mapEl } = buildContainer('', '')
    clampOverviewMapInViewport(container)
    expect(mapEl.style.width).toBe('')
    expect(overview.style.right).toBe('14px')
  })

  it('retargets the locked overview resolution after a resize', () => {
    const { container } = buildContainer()
    const { volumeViewer, view, updateSize } = buildVolumeViewer()
    clampOverviewMapInViewport(container, { volumeViewer })
    expect(updateSize).toHaveBeenCalled()
    const resolution = 500 / 120
    expect(view.applyOptions_).toHaveBeenCalledWith({
      minResolution: resolution,
      maxResolution: resolution,
      resolution,
      center: [500, 250],
      extent: [500, 250, 500, 250],
      constrainOnlyCenter: true,
      showFullExtent: true,
    })
  })

  it('uses the extent width for rotated overviews', () => {
    const { container } = buildContainer()
    const { volumeViewer, view } = buildVolumeViewer(Math.PI / 2)
    clampOverviewMapInViewport(container, { volumeViewer })
    expect(view.applyOptions_).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: 1000 / 120 }),
    )
  })

  it('skips the view update when the overview map has no size', () => {
    const { container } = buildContainer()
    const { volumeViewer, view } = buildVolumeViewer(0, [0, 0])
    clampOverviewMapInViewport(container, { volumeViewer })
    expect(view.applyOptions_).not.toHaveBeenCalled()
  })

  it('does not touch the view when the size is already fitted', () => {
    const { container } = buildContainer('120px', '120px')
    const { volumeViewer, updateSize } = buildVolumeViewer()
    clampOverviewMapInViewport(container, { volumeViewer })
    expect(updateSize).not.toHaveBeenCalled()
  })
})

describe('observeOverviewMapClamp', () => {
  let resizeCallback: ResizeObserverCallback | undefined
  let frames: FrameRequestCallback[] = []
  const disconnectResize = vi.fn()
  const OriginalResizeObserver = global.ResizeObserver

  function flushFrames(): void {
    const pending = frames
    frames = []
    for (const callback of pending) callback(0)
  }

  beforeEach(() => {
    resizeCallback = undefined
    frames = []
    disconnectResize.mockClear()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    global.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        disconnectResize()
      }
    }
  })

  afterEach(() => {
    global.ResizeObserver = OriginalResizeObserver
    vi.restoreAllMocks()
  })

  it('clamps immediately and resizes the viewer on container resize', () => {
    const { container, mapEl } = buildContainer()
    const resize = vi.fn()
    const stop = observeOverviewMapClamp(container, {
      volumeViewer: { resize },
    })
    expect(mapEl.style.width).toBe('300px')
    flushFrames()
    expect(mapEl.style.width).toBe('120px')

    resizeCallback?.([], {} as ResizeObserver)
    resizeCallback?.([], {} as ResizeObserver)
    flushFrames()
    expect(resize).toHaveBeenCalledTimes(1)

    stop()
    expect(disconnectResize).toHaveBeenCalled()
  })

  it('cancels pending frames when stopped', () => {
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames[id - 1] = () => undefined
    })
    const { container, mapEl } = buildContainer()
    const resize = vi.fn()
    const stop = observeOverviewMapClamp(container, {
      volumeViewer: { resize },
    })
    resizeCallback?.([], {} as ResizeObserver)

    stop()
    flushFrames()

    expect(resize).not.toHaveBeenCalled()
    expect(mapEl.style.width).toBe('300px')
  })

  it('re-clamps when DMV rewrites the mini-map size', async () => {
    const { container, mapEl } = buildContainer()
    const stop = observeOverviewMapClamp(container)
    flushFrames()
    await Promise.resolve()
    flushFrames()

    mapEl.style.width = '600px'
    await Promise.resolve()
    flushFrames()
    expect(mapEl.style.width).toBe('186px')
    stop()
  })
})

import { act, renderHook } from '@testing-library/react'
import type OlMap from 'ol/Map'

import type { SlideAffine } from '../../utils/slideCoordinates'
import { useViewportMetrics } from '../useViewportMetrics'

type Listener = (event: { coordinate: number[] }) => void

interface FakeMap {
  map: OlMap
  listeners: Map<string, Set<Listener>>
  viewport: HTMLDivElement
  setResolution: (resolution: number | undefined) => void
  emit: (type: string, coordinate?: number[]) => void
}

function createFakeMap(): FakeMap {
  const listeners = new Map<string, Set<Listener>>()
  const viewport = document.createElement('div')
  let resolution: number | undefined = 0.001
  const fake = {
    getView: () => ({
      getResolution: () => resolution,
      getCenter: () => [0, 0],
      getProjection: () => ({
        getMetersPerUnit: () => 1,
        getPointResolutionFunc: () => undefined,
      }),
    }),
    getViewport: () => viewport,
    on: (type: string, listener: Listener) => {
      const set = listeners.get(type) ?? new Set<Listener>()
      set.add(listener)
      listeners.set(type, set)
    },
    un: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener)
    },
  }
  return {
    /** The hook only touches the members faked above */
    map: fake as unknown as OlMap,
    listeners,
    viewport,
    setResolution: (value) => {
      resolution = value
    },
    emit: (type, coordinate = [0, 0]) => {
      for (const listener of listeners.get(type) ?? []) {
        listener({ coordinate })
      }
    },
  }
}

const identityAffine: SlideAffine = [
  [1, 0, 0],
  [0, 1, 0],
]

let frameCallbacks: FrameRequestCallback[] = []

function flushFrames(): void {
  const callbacks = frameCallbacks
  frameCallbacks = []
  act(() => {
    for (const callback of callbacks) callback(0)
  })
}

beforeEach(() => {
  frameCallbacks = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frameCallbacks.push(callback)
    return frameCallbacks.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useViewportMetrics', () => {
  it('reads the resolution on mount and after each move', () => {
    const fake = createFakeMap()
    const getMap = (): OlMap => fake.map
    const { result } = renderHook(() => useViewportMetrics(getMap, undefined))
    expect(result.current.micronsPerPixel).toBeCloseTo(1000)
    fake.setResolution(0.0005)
    act(() => fake.emit('moveend'))
    expect(result.current.micronsPerPixel).toBeCloseTo(500)
  })

  it('coalesces pointer moves into one cursor update per frame', () => {
    const fake = createFakeMap()
    const getMap = (): OlMap => fake.map
    const { result } = renderHook(() =>
      useViewportMetrics(getMap, identityAffine),
    )
    act(() => {
      fake.emit('pointermove', [1, -2])
      fake.emit('pointermove', [3, -5])
    })
    expect(frameCallbacks).toHaveLength(1)
    expect(result.current.cursor).toBeUndefined()
    flushFrames()
    expect(result.current.cursor).toEqual([3, 4])
  })

  it('has no cursor without a slide affine', () => {
    const fake = createFakeMap()
    const getMap = (): OlMap => fake.map
    const { result } = renderHook(() => useViewportMetrics(getMap, undefined))
    act(() => fake.emit('pointermove', [1, -2]))
    flushFrames()
    expect(result.current.cursor).toBeUndefined()
  })

  it('clears the cursor and drops pending updates on pointer leave', () => {
    const fake = createFakeMap()
    const getMap = (): OlMap => fake.map
    const { result } = renderHook(() =>
      useViewportMetrics(getMap, identityAffine),
    )
    act(() => fake.emit('pointermove', [1, -2]))
    flushFrames()
    expect(result.current.cursor).toEqual([1, 1])
    act(() => {
      fake.emit('pointermove', [5, -6])
      fake.viewport.dispatchEvent(new Event('pointerleave'))
    })
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
    expect(result.current.cursor).toBeUndefined()
  })

  it('unsubscribes on unmount', () => {
    const fake = createFakeMap()
    const getMap = (): OlMap => fake.map
    const { unmount } = renderHook(() =>
      useViewportMetrics(getMap, identityAffine),
    )
    act(() => fake.emit('pointermove', [1, -2]))
    unmount()
    expect(fake.listeners.get('moveend')?.size).toBe(0)
    expect(fake.listeners.get('pointermove')?.size).toBe(0)
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1)
  })

  it('does nothing without a map', () => {
    const { result } = renderHook(() =>
      useViewportMetrics(() => undefined, identityAffine),
    )
    expect(result.current).toEqual({
      micronsPerPixel: undefined,
      cursor: undefined,
    })
  })
})

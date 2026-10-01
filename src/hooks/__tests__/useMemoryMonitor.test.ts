import { act, renderHook } from '@testing-library/react'

import { type MemoryInfo, memoryMonitor } from '../../services/MemoryMonitor'
import NotificationMiddleware, {
  NotificationMiddlewareEvents,
} from '../../services/NotificationMiddleware'
import { useMemoryMonitor } from '../useMemoryMonitor'

function memory(overrides: Partial<MemoryInfo> = {}): MemoryInfo {
  return {
    usedJSHeapSize: 100,
    jsHeapSizeLimit: 1000,
    totalJSHeapSize: 200,
    usagePercentage: 10,
    remainingBytes: 900,
    isHighUsage: false,
    isCriticalUsage: false,
    apiMethod: 'chrome',
    timestamp: 0,
    ...overrides,
  }
}

let subscribers: Array<(memory: MemoryInfo) => void> = []

function publishMemory(info: MemoryInfo): void {
  act(() => {
    for (const subscriber of subscribers) subscriber(info)
  })
}

beforeEach(() => {
  subscribers = []
  vi.spyOn(memoryMonitor, 'subscribe').mockImplementation((callback) => {
    subscribers.push(callback)
    return () => {
      subscribers = subscribers.filter((item) => item !== callback)
    }
  })
  vi.spyOn(memoryMonitor, 'startMonitoring').mockImplementation(() => {})
  vi.spyOn(memoryMonitor, 'stopMonitoring').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMemoryMonitor', () => {
  it('stays idle while disabled', () => {
    const { result } = renderHook(() => useMemoryMonitor(false))
    expect(result.current).toBeNull()
    expect(memoryMonitor.startMonitoring).not.toHaveBeenCalled()
  })

  it('exposes the latest measurement while enabled', () => {
    const { result } = renderHook(() => useMemoryMonitor(true))
    expect(memoryMonitor.startMonitoring).toHaveBeenCalledTimes(1)
    const info = memory({ usedJSHeapSize: 321 })
    publishMemory(info)
    expect(result.current).toBe(info)
  })

  it('publishes a warning once per level change', () => {
    const onWarning = vi.fn()
    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnWarning,
      onWarning,
    )
    renderHook(() => useMemoryMonitor(true))
    const high = memory({ usagePercentage: 85, isHighUsage: true })
    publishMemory(high)
    publishMemory(high)
    expect(onWarning).toHaveBeenCalledTimes(1)
    expect(onWarning.mock.calls[0][0]).toContain('High memory usage: 85.0%')
    NotificationMiddleware.unsubscribe(
      NotificationMiddlewareEvents.OnWarning,
      onWarning,
    )
  })

  it('stops monitoring when disabled or unmounted', () => {
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useMemoryMonitor(enabled),
      { initialProps: { enabled: true } },
    )
    rerender({ enabled: false })
    expect(memoryMonitor.stopMonitoring).toHaveBeenCalledTimes(1)
    expect(subscribers).toHaveLength(0)
    rerender({ enabled: true })
    unmount()
    expect(memoryMonitor.stopMonitoring).toHaveBeenCalledTimes(2)
  })
})

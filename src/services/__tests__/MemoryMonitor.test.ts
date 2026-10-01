import {
  createMemoryInfo,
  memoryMonitor,
  unavailableMemoryInfo,
} from '../MemoryMonitor'

afterEach(() => {
  Reflect.deleteProperty(performance, 'memory')
})

describe('createMemoryInfo', () => {
  it('derives usage, remaining bytes and thresholds', () => {
    const info = createMemoryInfo('chrome', 850, 900, 1000, 7)
    expect(info).toEqual({
      usedJSHeapSize: 850,
      totalJSHeapSize: 900,
      jsHeapSizeLimit: 1000,
      usagePercentage: 85,
      remainingBytes: 150,
      isHighUsage: true,
      isCriticalUsage: false,
      apiMethod: 'chrome',
      timestamp: 7,
    })
  })

  it('clamps usage at 100% and remaining bytes at zero', () => {
    const info = createMemoryInfo('modern', 1200, 1200, 1000, 0)
    expect(info.usagePercentage).toBe(100)
    expect(info.remainingBytes).toBe(0)
    expect(info.isCriticalUsage).toBe(true)
  })
})

describe('memoryMonitor.measure', () => {
  it('reports unavailable without a memory API', async () => {
    const { memory } = await memoryMonitor.measure()
    expect(memory).toEqual({
      ...unavailableMemoryInfo(),
      timestamp: memory.timestamp,
    })
  })

  it('reads performance.memory and notifies subscribers', async () => {
    Object.defineProperty(performance, 'memory', {
      configurable: true,
      value: {
        usedJSHeapSize: 950,
        totalJSHeapSize: 960,
        jsHeapSizeLimit: 1000,
      },
    })
    const listener = vi.fn()
    const unsubscribe = memoryMonitor.subscribe(listener)
    const { memory } = await memoryMonitor.measure()
    unsubscribe()
    expect(memory.apiMethod).toBe('chrome')
    expect(memory.isCriticalUsage).toBe(true)
    expect(listener).toHaveBeenCalledWith(memory)
  })
})

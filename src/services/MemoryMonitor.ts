import { logger } from '../utils/logger'
import {
  CRITICAL_MEMORY_USAGE_PERCENT,
  HIGH_MEMORY_USAGE_PERCENT,
} from '../utils/memoryWarning'

/**
 * Memory monitoring service for tracking browser memory usage.
 *
 * Uses modern APIs when available:
 * - performance.measureUserAgentSpecificMemory() (Chrome 89+, requires cross-origin isolation)
 * - performance.memory (Chrome-specific, deprecated but still useful)
 */

export interface MemoryInfo {
  /**
   * Total memory used in bytes (JS heap size)
   */
  usedJSHeapSize: number | null

  /**
   * Maximum JS heap size limit in bytes
   */
  jsHeapSizeLimit: number | null

  /**
   * Total JS heap size allocated in bytes
   */
  totalJSHeapSize: number | null

  /**
   * Memory usage as percentage of limit (0-100)
   */
  usagePercentage: number | null

  /**
   * Estimated remaining memory in bytes
   */
  remainingBytes: number | null

  /**
   * Whether memory usage is considered high (>80% of limit)
   */
  isHighUsage: boolean

  /**
   * Whether memory usage is considered critical (>90% of limit)
   */
  isCriticalUsage: boolean

  /**
   * API method used: 'modern', 'chrome', or 'unavailable'
   */
  apiMethod: 'modern' | 'chrome' | 'unavailable'

  /**
   * Timestamp of measurement
   */
  timestamp: number
}

export interface MemoryMeasureResult {
  /**
   * Memory information
   */
  memory: MemoryInfo

  /**
   * Breakdown by context (main thread, workers, etc.)
   * Only available with modern API
   */
  breakdown?: Array<{
    bytes: number
    userAgentSpecificTypes: string[]
  }>
}

type MemoryUpdateCallback = (memory: MemoryInfo) => void

/**
 * 8 GB fallback for 64-bit browsers without jsHeapSizeLimit, so usage is not
 * stuck at 50% once more than 2 GB are used.
 */
const FALLBACK_HEAP_LIMIT_BYTES = 8 * 1024 * 1024 * 1024

const DEFAULT_UPDATE_INTERVAL_MS = 5000

function isModernApiAvailable(): boolean {
  return (
    typeof performance !== 'undefined' &&
    typeof performance.measureUserAgentSpecificMemory === 'function' &&
    typeof window !== 'undefined' &&
    window.crossOriginIsolated
  )
}

function chromeMemory(): PerformanceMemory | undefined {
  if (typeof performance === 'undefined') return undefined
  const memory = performance.memory
  return typeof memory?.usedJSHeapSize === 'number' ? memory : undefined
}

export function createMemoryInfo(
  apiMethod: 'modern' | 'chrome',
  usedJSHeapSize: number,
  totalJSHeapSize: number,
  jsHeapSizeLimit: number,
  now: number = Date.now(),
): MemoryInfo {
  const usagePercentage = (usedJSHeapSize / jsHeapSizeLimit) * 100
  return {
    usedJSHeapSize,
    jsHeapSizeLimit,
    totalJSHeapSize,
    usagePercentage: Math.min(usagePercentage, 100),
    remainingBytes: Math.max(0, jsHeapSizeLimit - usedJSHeapSize),
    isHighUsage: usagePercentage > HIGH_MEMORY_USAGE_PERCENT,
    isCriticalUsage: usagePercentage > CRITICAL_MEMORY_USAGE_PERCENT,
    apiMethod,
    timestamp: now,
  }
}

export function unavailableMemoryInfo(now: number = Date.now()): MemoryInfo {
  return {
    usedJSHeapSize: null,
    jsHeapSizeLimit: null,
    totalJSHeapSize: null,
    usagePercentage: null,
    remainingBytes: null,
    isHighUsage: false,
    isCriticalUsage: false,
    apiMethod: 'unavailable',
    timestamp: now,
  }
}

/** Falls back to unavailable rather than throwing, so callers always get a value */
function measureChromeOrUnavailable(): MemoryInfo {
  const memory = chromeMemory()
  if (memory === undefined) return unavailableMemoryInfo()
  return createMemoryInfo(
    'chrome',
    memory.usedJSHeapSize,
    memory.totalJSHeapSize,
    memory.jsHeapSizeLimit,
  )
}

function modernMemoryInfo(result: PerformanceMemoryInfo): MemoryInfo {
  const bytes = Number.isNaN(result.bytes) ? 0 : result.bytes
  const reportedLimit = chromeMemory()?.jsHeapSizeLimit
  const jsHeapSizeLimit =
    reportedLimit !== undefined && reportedLimit > 0
      ? reportedLimit
      : FALLBACK_HEAP_LIMIT_BYTES
  return createMemoryInfo('modern', bytes, bytes, jsHeapSizeLimit)
}

/**
 * Memory monitoring service
 */
class MemoryMonitor {
  private readonly updateCallbacks: Set<MemoryUpdateCallback> = new Set()
  private monitoringTimeoutId: ReturnType<typeof setTimeout> | null = null
  private monitoringActive: boolean = false

  /**
   * Measure current memory usage
   */
  async measure(): Promise<MemoryMeasureResult> {
    let memory: MemoryInfo
    let breakdown: MemoryMeasureResult['breakdown']

    const measureModern = isModernApiAvailable()
      ? performance.measureUserAgentSpecificMemory
      : undefined
    if (measureModern === undefined) {
      memory = measureChromeOrUnavailable()
    } else {
      try {
        const result = await measureModern.call(performance)
        memory = modernMemoryInfo(result)
        breakdown = result.breakdown?.map((item) => ({
          bytes: item.bytes,
          userAgentSpecificTypes: item.userAgentSpecificTypes ?? [],
        }))
      } catch {
        memory = measureChromeOrUnavailable()
      }
    }

    this.updateCallbacks.forEach((callback) => {
      try {
        callback(memory)
      } catch (error) {
        logger.error('Error in memory update callback:', error)
      }
    })

    return { memory, breakdown }
  }

  /**
   * Subscribe to memory updates
   */
  subscribe(callback: MemoryUpdateCallback): () => void {
    this.updateCallbacks.add(callback)

    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  /**
   * Start periodic memory monitoring. Serializes runs so the next tick is scheduled
   * only after the current measure() finishes, avoiding overlapping executions.
   */
  startMonitoring(interval: number = DEFAULT_UPDATE_INTERVAL_MS): void {
    if (this.monitoringTimeoutId != null) {
      this.stopMonitoring()
    }
    this.monitoringActive = true

    const scheduleNext = (): void => {
      if (!this.monitoringActive) return
      this.monitoringTimeoutId = setTimeout(() => {
        this.monitoringTimeoutId = null
        this.measure()
          .then(() => {
            scheduleNext()
          })
          .catch((error) => {
            logger.error('Error in periodic memory measurement:', error)
            scheduleNext()
          })
      }, interval)
    }

    this.measure()
      .then(() => {
        scheduleNext()
      })
      .catch((error) => {
        logger.error('Error in initial memory measurement:', error)
        scheduleNext()
      })
  }

  /**
   * Stop periodic memory monitoring
   */
  stopMonitoring(): void {
    this.monitoringActive = false
    if (this.monitoringTimeoutId != null) {
      clearTimeout(this.monitoringTimeoutId)
      this.monitoringTimeoutId = null
    }
  }
}

export const memoryMonitor = new MemoryMonitor()

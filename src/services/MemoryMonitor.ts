interface MemoryMeasureUserAgentSpecificMemoryResult {
  bytes: number
  breakdown?: Array<{
    bytes: number
    userAgentSpecificTypes: string[]
  }>
}

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
 * Memory monitoring service
 */
class MemoryMonitor {
  private readonly updateCallbacks: Set<MemoryUpdateCallback> = new Set()
  private monitoringInterval: ReturnType<typeof setInterval> | null = null
  private readonly updateInterval: number = 5000 // 5 seconds
  private lastMeasurement: MemoryInfo | null = null
  private readonly highUsageThreshold = 0.80 // 80%
  private readonly criticalUsageThreshold = 0.90 // 90%

  /**
   * Check if modern memory API is available
   */
  private isModernAPIAvailable (): boolean {
    return typeof performance !== 'undefined' &&
           typeof performance.measureUserAgentSpecificMemory === 'function' &&
           (window.crossOriginIsolated)
  }

  /**
   * Check if Chrome-specific memory API is available
   */
  private isChromeAPIAvailable (): boolean {
    return typeof performance !== 'undefined' &&
           performance.memory !== undefined &&
           typeof performance.memory.usedJSHeapSize === 'number'
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes (bytes: number | null): string {
    if (bytes === null || bytes === undefined) {
      return 'N/A'
    }

    if (bytes === 0) {
      return '0 Bytes'
    }

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Get memory info using modern API from already-fetched result
   */
  private getMemoryModernFromResult (result: MemoryMeasureUserAgentSpecificMemoryResult): MemoryInfo {
    const bytes = (result.bytes != null && !isNaN(result.bytes)) ? result.bytes : 0

    let jsHeapSizeLimit: number
    if (this.isChromeAPIAvailable() && performance.memory?.jsHeapSizeLimit != null && performance.memory.jsHeapSizeLimit > 0) {
      jsHeapSizeLimit = performance.memory.jsHeapSizeLimit
    } else {
      // Use 8GB as fallback limit for 64-bit browsers when jsHeapSizeLimit unavailable
      // This prevents usagePercentage from being stuck at 50% when bytes > 2GB
      jsHeapSizeLimit = 8 * 1024 * 1024 * 1024
    }

    const usagePercentage = (bytes / jsHeapSizeLimit) * 100

    return {
      usedJSHeapSize: bytes,
      jsHeapSizeLimit,
      totalJSHeapSize: bytes,
      usagePercentage: Math.min(usagePercentage, 100),
      remainingBytes: Math.max(0, jsHeapSizeLimit - bytes),
      isHighUsage: usagePercentage > this.highUsageThreshold * 100,
      isCriticalUsage: usagePercentage > this.criticalUsageThreshold * 100,
      apiMethod: 'modern',
      timestamp: Date.now()
    }
  }

  /**
   * Get memory info using Chrome-specific API
   */
  private getMemoryChrome (): MemoryInfo {
    const memory = performance.memory
    if (memory == null) {
      throw new Error('performance.memory not available')
    }
    const usedJSHeapSize = memory.usedJSHeapSize
    const totalJSHeapSize = memory.totalJSHeapSize
    const jsHeapSizeLimit = memory.jsHeapSizeLimit

    const usagePercentage = (usedJSHeapSize / jsHeapSizeLimit) * 100
    const remainingBytes = jsHeapSizeLimit - usedJSHeapSize

    return {
      usedJSHeapSize,
      jsHeapSizeLimit,
      totalJSHeapSize,
      usagePercentage,
      remainingBytes: Math.max(0, remainingBytes),
      isHighUsage: usagePercentage > this.highUsageThreshold * 100,
      isCriticalUsage: usagePercentage > this.criticalUsageThreshold * 100,
      apiMethod: 'chrome',
      timestamp: Date.now()
    }
  }

  /**
   * Get memory info (unavailable)
   */
  private getMemoryUnavailable (): MemoryInfo {
    return {
      usedJSHeapSize: null,
      jsHeapSizeLimit: null,
      totalJSHeapSize: null,
      usagePercentage: null,
      remainingBytes: null,
      isHighUsage: false,
      isCriticalUsage: false,
      apiMethod: 'unavailable',
      timestamp: Date.now()
    }
  }

  /**
   * Measure current memory usage
   */
  async measure (): Promise<MemoryMeasureResult> {
    let memory: MemoryInfo
    let breakdown: Array<{ bytes: number, userAgentSpecificTypes: string[] }> | undefined

    if (this.isModernAPIAvailable()) {
      try {
        if (performance.measureUserAgentSpecificMemory == null) {
          throw new Error('measureUserAgentSpecificMemory not available')
        }
        const result = await performance.measureUserAgentSpecificMemory()
        memory = this.getMemoryModernFromResult(result)

        if (result.breakdown != null) {
          breakdown = result.breakdown.map(item => ({
            bytes: item.bytes,
            userAgentSpecificTypes: item.userAgentSpecificTypes != null ? item.userAgentSpecificTypes : []
          }))
        }
      } catch (error) {
        // Modern API failed, try Chrome fallback
        if (this.isChromeAPIAvailable()) {
          memory = this.getMemoryChrome()
        } else {
          memory = this.getMemoryUnavailable()
        }
      }
    } else if (this.isChromeAPIAvailable()) {
      memory = this.getMemoryChrome()
    } else {
      memory = this.getMemoryUnavailable()
    }

    this.lastMeasurement = memory

    this.updateCallbacks.forEach(callback => {
      try {
        callback(memory)
      } catch (error) {
        console.error('Error in memory update callback:', error)
      }
    })

    return { memory, breakdown }
  }

  /**
   * Get last measured memory info (synchronous)
   */
  getLastMeasurement (): MemoryInfo | null {
    return this.lastMeasurement
  }

  /**
   * Subscribe to memory updates
   */
  subscribe (callback: MemoryUpdateCallback): () => void {
    this.updateCallbacks.add(callback)

    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  /**
   * Start periodic memory monitoring
   */
  startMonitoring (interval: number = this.updateInterval): void {
    if (this.monitoringInterval !== null) {
      this.stopMonitoring()
    }

    this.measure().catch(error => {
      console.error('Error in initial memory measurement:', error)
    })

    this.monitoringInterval = setInterval(() => {
      this.measure().catch(error => {
        console.error('Error in periodic memory measurement:', error)
      })
    }, interval)
  }

  /**
   * Stop periodic memory monitoring
   */
  stopMonitoring (): void {
    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring (): boolean {
    return this.monitoringInterval !== null
  }

  /**
   * Get status message for current memory usage
   */
  getStatusMessage (memory: MemoryInfo | null): string {
    if (memory === null || memory.apiMethod === 'unavailable') {
      return 'Memory monitoring unavailable'
    }

    if (memory.isCriticalUsage) {
      const percentage = memory.usagePercentage != null ? memory.usagePercentage.toFixed(1) : 'N/A'
      return `Critical: ${percentage}% used (${this.formatBytes(memory.remainingBytes)} remaining)`
    }

    if (memory.isHighUsage) {
      const percentage = memory.usagePercentage != null ? memory.usagePercentage.toFixed(1) : 'N/A'
      return `High: ${percentage}% used (${this.formatBytes(memory.remainingBytes)} remaining)`
    }

    const percentage = memory.usagePercentage != null ? memory.usagePercentage.toFixed(1) : 'N/A'
    return `Memory: ${percentage}% used (${this.formatBytes(memory.remainingBytes)} remaining)`
  }

  /**
   * Get warning level for memory usage
   */
  getWarningLevel (memory: MemoryInfo | null): 'none' | 'high' | 'critical' {
    if (memory === null || memory.apiMethod === 'unavailable') {
      return 'none'
    }

    if (memory.isCriticalUsage) {
      return 'critical'
    }

    if (memory.isHighUsage) {
      return 'high'
    }

    return 'none'
  }
}

// Export singleton instance
export const memoryMonitor = new MemoryMonitor()

// Auto-start monitoring when module loads (optional - can be controlled by app)
// memoryMonitor.startMonitoring()

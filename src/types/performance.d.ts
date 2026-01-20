/**
 * Type declarations for experimental Performance API methods
 */

interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface PerformanceMemoryInfo {
  bytes: number
  breakdown?: Array<{
    bytes: number
    userAgentSpecificTypes: string[]
  }>
}

interface Performance {
  memory?: PerformanceMemory
  measureUserAgentSpecificMemory?(): Promise<PerformanceMemoryInfo>
}

interface Window {
  crossOriginIsolated?: boolean
}

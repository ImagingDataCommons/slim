import { useEffect, useRef, useState } from 'react'

import { type MemoryInfo, memoryMonitor } from '../services/MemoryMonitor'
import NotificationMiddleware, {
  NotificationMiddlewareEvents,
} from '../services/NotificationMiddleware'

const CRITICAL_WARNING_THROTTLE_MS = 30000

/**
 * Subscribes to the shared memory monitor while `enabled` and publishes
 * high/critical usage warnings to the notification middleware.
 */
export function useMemoryMonitor(enabled: boolean): MemoryInfo | null {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null)
  const lastWarningLevel = useRef<'none' | 'high' | 'critical'>('none')
  const lastCriticalWarningTime = useRef(0)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const unsubscribe = memoryMonitor.subscribe((memory: MemoryInfo) => {
      setMemoryInfo(memory)
      const warningLevel = memoryMonitor.getWarningLevel(memory)
      if (warningLevel === lastWarningLevel.current) {
        return
      }
      lastWarningLevel.current = warningLevel
      if (memory.usagePercentage === null) {
        return
      }
      if (warningLevel === 'critical') {
        const now = Date.now()
        if (
          now - lastCriticalWarningTime.current >=
          CRITICAL_WARNING_THROTTLE_MS
        ) {
          lastCriticalWarningTime.current = now
          NotificationMiddleware.publish(
            NotificationMiddlewareEvents.OnWarning,
            `Critical memory usage: ${memory.usagePercentage.toFixed(1)}% used. ` +
              `Only ${memoryMonitor.formatBytes(memory.remainingBytes)} remaining. ` +
              'Consider refreshing the page or closing other tabs.',
          )
        }
      } else if (warningLevel === 'high') {
        NotificationMiddleware.publish(
          NotificationMiddlewareEvents.OnWarning,
          `High memory usage: ${memory.usagePercentage.toFixed(1)}% used. ` +
            `${memoryMonitor.formatBytes(memory.remainingBytes)} remaining.`,
        )
      }
    })
    memoryMonitor.startMonitoring()
    return () => {
      unsubscribe()
      memoryMonitor.stopMonitoring()
    }
  }, [enabled])

  return memoryInfo
}

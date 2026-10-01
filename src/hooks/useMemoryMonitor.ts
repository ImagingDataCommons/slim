import { useEffect, useRef, useState } from 'react'

import { type MemoryInfo, memoryMonitor } from '../services/MemoryMonitor'
import NotificationMiddleware, {
  NotificationMiddlewareEvents,
} from '../services/NotificationMiddleware'
import {
  evaluateMemoryWarning,
  INITIAL_MEMORY_WARNING_STATE,
} from '../utils/memoryWarning'

/**
 * Subscribes to the shared memory monitor while `enabled` and publishes
 * high/critical usage warnings to the notification middleware.
 */
export function useMemoryMonitor(enabled: boolean): MemoryInfo | null {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null)
  const warningState = useRef(INITIAL_MEMORY_WARNING_STATE)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const unsubscribe = memoryMonitor.subscribe((memory: MemoryInfo) => {
      setMemoryInfo(memory)
      const { state, message } = evaluateMemoryWarning(
        {
          level: memoryMonitor.getWarningLevel(memory),
          usagePercentage: memory.usagePercentage,
          remaining: memoryMonitor.formatBytes(memory.remainingBytes),
        },
        warningState.current,
        Date.now(),
      )
      warningState.current = state
      if (message !== null) {
        NotificationMiddleware.publish(
          NotificationMiddlewareEvents.OnWarning,
          message,
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

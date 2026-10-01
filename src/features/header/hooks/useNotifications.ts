import { useCallback, useEffect, useRef, useState } from 'react'

import NotificationMiddleware, {
  type ErrorNotification,
  NotificationMiddlewareEvents,
} from '../../../services/NotificationMiddleware'

export type { ErrorNotification }

export interface UseNotificationsOptions {
  /** Notifications are cleared whenever this value changes, e.g. the route */
  resetKey?: string
}

export interface UseNotificationsReturn {
  /** Reported errors with their source, oldest first */
  errors: ErrorNotification[]
  warnings: string[]
  errorCount: number
  warningCount: number
  clearNotifications: () => void
}

/** Errors and warnings published by NotificationMiddleware while mounted. */
export function useNotifications({
  resetKey,
}: UseNotificationsOptions = {}): UseNotificationsReturn {
  const [errors, setErrors] = useState<ErrorNotification[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    const handleError = (notification: ErrorNotification): void => {
      setErrors((previous) => [...previous, notification])
    }
    const handleWarning = (warning: string): void => {
      setWarnings((previous) => [...previous, warning])
    }

    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnError,
      handleError,
    )
    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnWarning,
      handleWarning,
    )
    return () => {
      NotificationMiddleware.unsubscribe(
        NotificationMiddlewareEvents.OnError,
        handleError,
      )
      NotificationMiddleware.unsubscribe(
        NotificationMiddlewareEvents.OnWarning,
        handleWarning,
      )
    }
  }, [])

  const clearNotifications = useCallback(() => {
    setErrors((previous) => (previous.length === 0 ? previous : []))
    setWarnings((previous) => (previous.length === 0 ? previous : []))
  }, [])

  const previousResetKey = useRef(resetKey)
  useEffect(() => {
    if (previousResetKey.current === resetKey) return
    previousResetKey.current = resetKey
    clearNotifications()
  }, [resetKey, clearNotifications])

  return {
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length,
    clearNotifications,
  }
}

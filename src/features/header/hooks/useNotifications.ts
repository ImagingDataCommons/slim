import { useCallback, useEffect, useState } from 'react'

import NotificationMiddleware, {
  NotificationMiddlewareEvents,
} from '../../../services/NotificationMiddleware'
import type { CustomError } from '../../../utils/CustomError'

export interface ExtendedError extends CustomError {
  source: string
}

interface UseNotificationsReturn {
  /** Array of error objects with source information */
  errors: ExtendedError[]
  /** Array of error categories/types */
  errorCategories: string[]
  /** Array of warning messages */
  warnings: string[]
  /** Total count of errors */
  errorCount: number
  /** Total count of warnings */
  warningCount: number
  /** Clear all notifications */
  clearNotifications: () => void
}

/**
 * Hook for subscribing to and managing application notifications.
 * Tracks errors and warnings from NotificationMiddleware.
 */
export function useNotifications(): UseNotificationsReturn {
  const [errors, setErrors] = useState<ExtendedError[]>([])
  const [errorCategories, setErrorCategories] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    const handleError = ({
      source,
      error,
    }: {
      source: string
      error: CustomError
    }): void => {
      setErrors((prev) => [...prev, { ...error, source }])
      setErrorCategories((prev) => [...prev, error.type])
    }

    const handleWarning = (warning: string): void => {
      setWarnings((prev) => [...prev, warning])
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
    setErrors([])
    setErrorCategories([])
    setWarnings([])
  }, [])

  return {
    errors,
    errorCategories,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length,
    clearNotifications,
  }
}

/**
 * Groups errors by category for display.
 */
export function groupErrorsByCategory(
  errors: ExtendedError[],
  categories: string[],
): {
  Authentication: string[]
  Communication: string[]
  EncodingDecoding: string[]
  Visualization: string[]
} {
  const grouped = {
    Authentication: [] as string[],
    Communication: [] as string[],
    EncodingDecoding: [] as string[],
    Visualization: [] as string[],
  }

  errors.forEach((error, index) => {
    const category = categories[index] as keyof typeof grouped
    if (grouped[category]) {
      grouped[category].push(`${error.message} (Source: ${error.source})`)
    }
  })

  return grouped
}

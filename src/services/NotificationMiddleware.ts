import { publishToast } from '../features/viewer/services/toast'
import { toToastNotification } from '../features/viewer/utils/toastQueue'
import { CustomError, errorTypes } from '../utils/CustomError'
import PubSub from '../utils/PubSub'

export const NotificationMiddlewareEvents = {
  OnError: 'onError',
  OnWarning: 'onWarning',
  /** Transient user feedback shown as a toast: `{ message, tone }` */
  OnInfo: 'onInfo',
} as const

export type NotificationMiddlewareEvent =
  (typeof NotificationMiddlewareEvents)[keyof typeof NotificationMiddlewareEvents]

export const NotificationMiddlewareContext = {
  DICOMWEB: 'dicomweb-client',
  DMV: 'dicom-microscopy-viewer',
  DCMJS: 'dcmjs',
  SLIM: 'slim',
  AUTH: 'authentication',
} as const

export type NotificationSource =
  (typeof NotificationMiddlewareContext)[keyof typeof NotificationMiddlewareContext]

export interface ErrorNotification {
  source: NotificationSource
  error: CustomError
}

/** Payload type of each notification event */
export interface NotificationEventMap {
  onError: ErrorNotification
  onWarning: string
  onInfo: unknown
}

type NotificationListener<K extends NotificationMiddlewareEvent> = (
  payload: NotificationEventMap[K],
) => void

const NotificationType = {
  TOAST: 'toast',
  CONSOLE: 'console',
} as const

type NotificationKind = (typeof NotificationType)[keyof typeof NotificationType]

const WARNING_CATEGORY = 'Warning'

/**
 * Sources of Error:
 * 1. 'dicomweb-client': Error while requesting/fetching data, tagged as 'Communication'
 * 2. 'slim' and 'dicom-microscopy-viewer' library: Error related to dicom data encoding/decoding,
 * could directly/indirectly impact image-related visualization, tagged as 'Visualization' or
 * 'Encoding/Decoding' accordingly
 * 3. 'dcmjs' library: Data parsing error, tagged as 'DICOMError'
 * 4. 'authentication': Error during user authentication, tagged as 'Authentication'
 */
const NOTIFICATION_TYPE_BY_CATEGORY: Readonly<
  Record<string, NotificationKind>
> = {
  [errorTypes.AUTHENTICATION]: NotificationType.TOAST,
  [errorTypes.COMMUNICATION]: NotificationType.TOAST,
  [errorTypes.VISUALIZATION]: NotificationType.TOAST,
  [errorTypes.ENCODINGANDDECODING]: NotificationType.CONSOLE,
  [WARNING_CATEGORY]: NotificationType.TOAST,
}

/** Errors of unknown category are logged, never toasted. */
export function notificationTypeForCategory(
  category: unknown,
): NotificationKind {
  return typeof category === 'string'
    ? (NOTIFICATION_TYPE_BY_CATEGORY[category] ?? NotificationType.CONSOLE)
    : NotificationType.CONSOLE
}

class NotificationMiddleware extends PubSub {
  constructor() {
    super()

    const publishWarning = (args: unknown[]): void => {
      this.publish(NotificationMiddlewareEvents.OnWarning, args.join(' '))
    }

    const warn = console.warn
    console.warn = (...args: unknown[]): void => {
      if (!JSON.stringify(args).includes('request')) {
        publishWarning(args)
      }
      warn.apply(console, args)
    }

    super.subscribe(NotificationMiddlewareEvents.OnInfo, (payload: unknown) => {
      const notification = toToastNotification(payload)
      if (notification !== undefined) {
        publishToast(
          notification.message,
          notification.tone,
          notification.title,
        )
      }
    })
  }

  subscribe<K extends NotificationMiddlewareEvent>(
    eventName: K,
    callback: NotificationListener<K>,
  ): void {
    super.subscribe(eventName, callback)
  }

  unsubscribe<K extends NotificationMiddlewareEvent>(
    eventName: K,
    callback?: NotificationListener<K>,
  ): void {
    super.unsubscribe(eventName, callback)
  }

  publish<K extends NotificationMiddlewareEvent>(
    eventName: K,
    payload: NotificationEventMap[K],
  ): void {
    super.publish(eventName, payload)
  }

  /**
   * Error handling middleware function
   *
   * @param source - source of error - dicomweb-client, dmv, dcmjs or slim itself
   * @param error - error object
   */
  onError(source: NotificationSource, error: CustomError): void {
    const errorCategory: unknown = error.type
    const notificationType = notificationTypeForCategory(errorCategory)

    this.publish(NotificationMiddlewareEvents.OnError, { source, error })

    if (import.meta.env.MODE === 'development') {
      console.error(`A ${String(errorCategory)} error occurred: `, error)
    }

    if (notificationType !== NotificationType.TOAST) return

    const message =
      error instanceof CustomError ? String(error.message) : String(error)
    if (errorCategory === WARNING_CATEGORY) {
      publishToast(message, 'warning')
    } else {
      publishToast(message, 'error', `${String(errorCategory)} error`)
    }
  }
}

const notificationMiddleware = new NotificationMiddleware()

export default notificationMiddleware

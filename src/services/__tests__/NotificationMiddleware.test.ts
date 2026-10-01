import { toastStore } from '../../features/viewer/services/toast'
import { CustomError, errorTypes } from '../../utils/CustomError'
import NotificationMiddleware, {
  type ErrorNotification,
  NotificationMiddlewareContext,
  NotificationMiddlewareEvents,
  notificationTypeForCategory,
} from '../NotificationMiddleware'

describe('notificationTypeForCategory', () => {
  it('toasts user-facing categories', () => {
    expect(notificationTypeForCategory(errorTypes.AUTHENTICATION)).toBe('toast')
    expect(notificationTypeForCategory(errorTypes.COMMUNICATION)).toBe('toast')
    expect(notificationTypeForCategory(errorTypes.VISUALIZATION)).toBe('toast')
    expect(notificationTypeForCategory('Warning')).toBe('toast')
  })

  it('only logs encoding errors and unknown categories', () => {
    expect(notificationTypeForCategory(errorTypes.ENCODINGANDDECODING)).toBe(
      'console',
    )
    expect(notificationTypeForCategory('Nope')).toBe('console')
    expect(notificationTypeForCategory(undefined)).toBe('console')
  })
})

describe('NotificationMiddleware', () => {
  beforeEach(() => {
    toastStore.clear()
    toastStore.configure(undefined)
  })

  it('publishes OnError and an error toast for toast categories', () => {
    const listener = vi.fn<(...args: [ErrorNotification]) => void>()
    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnError,
      listener,
    )
    const error = new CustomError(errorTypes.COMMUNICATION, 'Server is down')
    NotificationMiddleware.onError(NotificationMiddlewareContext.SLIM, error)
    NotificationMiddleware.unsubscribe(
      NotificationMiddlewareEvents.OnError,
      listener,
    )

    expect(listener).toHaveBeenCalledWith({ source: 'slim', error })
    expect(toastStore.getSnapshot()).toEqual([
      expect.objectContaining({
        message: 'Server is down',
        tone: 'error',
        title: 'Communication error',
      }),
    ])
  })

  it('shows warning-category errors as warning toasts', () => {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError('Warning', 'Careful'),
    )
    expect(toastStore.getSnapshot()).toEqual([
      expect.objectContaining({ message: 'Careful', tone: 'warning' }),
    ])
  })

  it('does not toast encoding errors', () => {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.DCMJS,
      new CustomError(errorTypes.ENCODINGANDDECODING, 'Bad dataset'),
    )
    expect(toastStore.getSnapshot()).toHaveLength(0)
  })

  it('shows error notifications even when config.messages disables them', () => {
    toastStore.configure({ disabled: true })
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.AUTH,
      new CustomError(errorTypes.AUTHENTICATION, 'Denied'),
    )
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError('Warning', 'Careful'),
    )
    expect(toastStore.getSnapshot()).toEqual([
      expect.objectContaining({ message: 'Denied', tone: 'error' }),
      expect.objectContaining({ message: 'Careful', tone: 'warning' }),
    ])
  })

  it('dismisses error notifications after 3 s whatever the duration', () => {
    vi.useFakeTimers()
    try {
      toastStore.configure({ duration: 0 })
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.DICOMWEB,
        new CustomError(errorTypes.COMMUNICATION, 'Server is down'),
      )
      vi.advanceTimersByTime(2999)
      expect(toastStore.getSnapshot()).toHaveLength(1)
      vi.advanceTimersByTime(1)
      expect(toastStore.getSnapshot()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('still applies config.messages to OnInfo toasts', () => {
    toastStore.configure({ disabled: ['success'] })
    NotificationMiddleware.publish(NotificationMiddlewareEvents.OnInfo, {
      message: 'Saved',
      tone: 'success',
    })
    expect(toastStore.getSnapshot()).toHaveLength(0)
  })

  it('forwards OnInfo payloads to the toast queue', () => {
    NotificationMiddleware.publish(NotificationMiddlewareEvents.OnInfo, {
      message: 'Saved',
      tone: 'success',
    })
    NotificationMiddleware.publish(NotificationMiddlewareEvents.OnInfo, '')
    expect(toastStore.getSnapshot()).toEqual([
      expect.objectContaining({ message: 'Saved', tone: 'success' }),
    ])
  })
})

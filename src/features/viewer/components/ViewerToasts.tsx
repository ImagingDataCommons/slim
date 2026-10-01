import type React from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { Icon } from '../../../components/ui/icon'
import NotificationMiddleware, {
  NotificationMiddlewareEvents,
} from '../../../services/NotificationMiddleware'
import {
  dismissToast,
  enqueueToast,
  TOAST_DURATION_MS,
  type Toast,
  type ToastTone,
  toToastNotification,
} from '../utils/toastQueue'

const TONE_ICON: Record<ToastTone, { name: string; className: string }> = {
  info: { name: 'info', className: 'text-primary' },
  success: { name: 'check_circle', className: 'text-success' },
  warning: { name: 'warning', className: 'text-warning-text' },
}

/** Show a transient toast in the viewer. */
export function publishToast(message: string, tone: ToastTone = 'info'): void {
  NotificationMiddleware.publish(NotificationMiddlewareEvents.OnInfo, {
    message,
    tone,
  })
}

/**
 * Bottom-center toast stack over the viewport for `OnInfo` notifications
 * (save confirmations, ROI removal, ICC warnings).
 */
export function ViewerToasts(): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number): void => {
    const timer = timers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => dismissToast(current, id))
  }, [])

  /** Layout effect so the subscription exists before parents' did-mount publish */
  useLayoutEffect(() => {
    const pending = timers.current
    const handleInfo = (payload: unknown): void => {
      const notification = toToastNotification(payload)
      if (notification === undefined) return
      const id = nextId.current++
      setToasts((current) => enqueueToast(current, { id, ...notification }))
      pending.set(
        id,
        window.setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      )
    }
    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnInfo,
      handleInfo,
    )
    return () => {
      NotificationMiddleware.unsubscribe(
        NotificationMiddlewareEvents.OnInfo,
        handleInfo,
      )
      for (const timer of pending.values()) window.clearTimeout(timer)
      pending.clear()
    }
  }, [dismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((toast) => {
        const icon = TONE_ICON[toast.tone]
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-panel py-2 pl-3 pr-1.5 text-[12.5px] text-ink shadow-overlay"
          >
            <Icon name={icon.name} size={18} className={icon.className} />
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition-colors hover:bg-app hover:text-ink"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

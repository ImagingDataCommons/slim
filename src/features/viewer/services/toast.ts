import {
  dismissToast,
  enqueueToast,
  isToastToneDisabled,
  type Toast,
  type ToastConfig,
  type ToastNotification,
  type ToastPublishOptions,
  type ToastTone,
  toastDurationMs,
} from '../utils/toastQueue'

export interface ToastStore {
  getSnapshot: () => readonly Toast[]
  subscribe: (listener: () => void) => () => void
  publish: (
    notification: ToastNotification,
    options?: ToastPublishOptions,
  ) => void
  dismiss: (id: number) => void
  configure: (config: ToastConfig | undefined) => void
  /** Drop every toast and pending timer */
  clear: () => void
}

/**
 * Toast queue with its own auto-dismiss timers, so toasts published before
 * a host mounts (or between route changes) are kept until they expire.
 */
export function createToastStore(): ToastStore {
  let toasts: readonly Toast[] = []
  let config: ToastConfig | undefined
  let nextId = 0
  const listeners = new Set<() => void>()
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const clearTimer = (id: number): void => {
    const timer = timers.get(id)
    if (timer !== undefined) clearTimeout(timer)
    timers.delete(id)
  }

  const dismiss = (id: number): void => {
    clearTimer(id)
    const next = dismissToast(toasts, id)
    if (next.length === toasts.length) return
    toasts = next
    emit()
  }

  const publish = (
    notification: ToastNotification,
    options: ToastPublishOptions = {},
  ): void => {
    if (
      options.ignoreConfig !== true &&
      isToastToneDisabled(notification.tone, config)
    ) {
      return
    }
    const id = nextId++
    toasts = enqueueToast(toasts, { id, ...notification })
    for (const timerId of timers.keys()) {
      if (!toasts.some((toast) => toast.id === timerId)) clearTimer(timerId)
    }
    const delay = options.durationMs ?? toastDurationMs(config)
    if (delay !== undefined) {
      timers.set(
        id,
        setTimeout(() => dismiss(id), delay),
      )
    }
    emit()
  }

  return {
    getSnapshot: () => toasts,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    publish,
    dismiss,
    configure: (nextConfig) => {
      config = nextConfig
    },
    clear: () => {
      for (const id of timers.keys()) clearTimer(id)
      if (toasts.length === 0) return
      toasts = []
      emit()
    },
  }
}

export const toastStore = createToastStore()

/** Show a transient toast (honors `config.messages` unless told not to). */
export function publishToast(
  message: string,
  tone: ToastTone = 'info',
  title?: string,
  options?: ToastPublishOptions,
): void {
  toastStore.publish(
    {
      message,
      tone,
      ...(title !== undefined ? { title } : {}),
    },
    options,
  )
}

/** Apply `config.messages` to every toast published from now on. */
export function configureToasts(config: ToastConfig | undefined): void {
  toastStore.configure(config)
}

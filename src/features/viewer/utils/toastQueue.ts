/** Pure state helpers for the app's transient toast messages. */

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastNotification {
  message: string
  tone: ToastTone
  /** Bold first line, e.g. "Communication error" */
  title?: string
}

export interface Toast extends ToastNotification {
  id: number
}

/** `config.messages` from AppConfig */
export interface ToastConfig {
  /** `true` disables every toast; an array disables the listed tones */
  disabled?: boolean | string[]
  /** Seconds a toast stays visible; `0` or less keeps it until dismissed */
  duration?: number
  /** Distance of the toast stack from the top of the window, in px */
  top?: number
}

export const MAX_VISIBLE_TOASTS = 3

export const TOAST_DURATION_MS = 4000

const TONES: readonly ToastTone[] = ['info', 'success', 'warning', 'error']

export function isToastTone(value: unknown): value is ToastTone {
  return TONES.some((tone) => tone === value)
}

/**
 * Normalize an `OnInfo` payload: a plain string or `{ message, tone, title }`.
 * Returns `undefined` for empty or malformed payloads.
 */
export function toToastNotification(
  payload: unknown,
): ToastNotification | undefined {
  if (typeof payload === 'string') {
    return payload.trim() !== ''
      ? { message: payload, tone: 'info' }
      : undefined
  }
  if (typeof payload !== 'object' || payload === null) return undefined
  const message = 'message' in payload ? payload.message : undefined
  const tone = 'tone' in payload ? payload.tone : undefined
  const title = 'title' in payload ? payload.title : undefined
  if (typeof message !== 'string' || message.trim() === '') return undefined
  return {
    message,
    tone: isToastTone(tone) ? tone : 'info',
    ...(typeof title === 'string' && title !== '' ? { title } : {}),
  }
}

/** Whether `config.messages.disabled` suppresses toasts of `tone`. */
export function isToastToneDisabled(
  tone: ToastTone,
  config: ToastConfig | undefined,
): boolean {
  const disabled = config?.disabled
  if (typeof disabled === 'boolean') return disabled
  return Array.isArray(disabled) && disabled.includes(tone)
}

/**
 * Auto-dismiss delay in ms, or `undefined` when the toast stays until the
 * user dismisses it (`duration <= 0`).
 */
export function toastDurationMs(
  config: ToastConfig | undefined,
): number | undefined {
  const duration = config?.duration
  if (duration === undefined || !Number.isFinite(duration)) {
    return TOAST_DURATION_MS
  }
  return duration > 0 ? duration * 1000 : undefined
}

/** Append a toast, dropping the oldest beyond `max`. */
export function enqueueToast(
  toasts: readonly Toast[],
  toast: Toast,
  max: number = MAX_VISIBLE_TOASTS,
): Toast[] {
  return [...toasts, toast].slice(-Math.max(1, max))
}

export function dismissToast(toasts: readonly Toast[], id: number): Toast[] {
  return toasts.filter((toast) => toast.id !== id)
}

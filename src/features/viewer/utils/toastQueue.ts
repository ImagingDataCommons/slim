/** Pure state helpers for the viewer's transient toast messages. */

export type ToastTone = 'info' | 'success' | 'warning'

export interface ToastNotification {
  message: string
  tone: ToastTone
}

export interface Toast extends ToastNotification {
  id: number
}

export const MAX_VISIBLE_TOASTS = 3

export const TOAST_DURATION_MS = 4000

const TONES: readonly ToastTone[] = ['info', 'success', 'warning']

/**
 * Normalize an `OnInfo` payload: a plain string or `{ message, tone }`.
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
  const { message, tone } = payload as { message?: unknown; tone?: unknown }
  if (typeof message !== 'string' || message.trim() === '') return undefined
  return {
    message,
    tone: TONES.includes(tone as ToastTone) ? (tone as ToastTone) : 'info',
  }
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

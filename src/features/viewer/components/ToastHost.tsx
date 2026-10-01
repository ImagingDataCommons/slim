import type React from 'react'
import { useSyncExternalStore } from 'react'

import { Icon, type IconName } from '../../../components/ui/icon'
import { cn } from '../../../lib/utils'
import { type ToastStore, toastStore } from '../services/toast'
import type { ToastTone } from '../utils/toastQueue'

const TONE_ICON: Record<ToastTone, { name: IconName; className: string }> = {
  info: { name: 'info', className: 'text-primary' },
  success: { name: 'check_circle', className: 'text-success' },
  warning: { name: 'warning', className: 'text-warning-text' },
  error: { name: 'error', className: 'text-destructive' },
}

export interface ToastHostProps {
  /** `config.messages.top`: anchor the stack this many px from the top */
  top?: number
  store?: ToastStore
}

/**
 * App-wide toast stack (save confirmations, ROI removal, ICC warnings and
 * user-facing errors). Bottom-center unless `top` is configured.
 */
export function ToastHost({
  top,
  store = toastStore,
}: ToastHostProps): React.ReactElement {
  const toasts = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const isTopAnchored = top !== undefined && Number.isFinite(top)

  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2',
        !isTopAnchored && 'bottom-10',
      )}
      style={isTopAnchored ? { top } : undefined}
    >
      {toasts.map((toast) => {
        const icon = TONE_ICON[toast.tone]
        return (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-[480px] items-center gap-2 rounded-lg border border-line bg-panel py-2 pl-3 pr-1.5 text-[12.5px] text-ink shadow-overlay"
          >
            <Icon
              name={icon.name}
              size={18}
              className={cn('flex-none', icon.className)}
            />
            <span className="min-w-0">
              {toast.title !== undefined && (
                <span className="block font-semibold">{toast.title}</span>
              )}
              <span className="break-words">{toast.message}</span>
            </span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => store.dismiss(toast.id)}
              className="grid h-6 w-6 flex-none place-items-center rounded-md text-ink-muted transition-colors hover:bg-app hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

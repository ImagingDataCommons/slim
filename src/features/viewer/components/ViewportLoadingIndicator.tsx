import type * as React from 'react'

import { cn } from '../../../lib/utils'

/**
 * Centered, non-blocking pill shown over the viewport while an image loads.
 * Fades in after a short delay so cached slides do not flash it.
 */
export function ViewportLoadingIndicator({
  isVisible,
  label,
}: {
  isVisible: boolean
  label: string
}): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
    >
      <div
        aria-hidden={!isVisible}
        className={cn(
          'flex items-center gap-2.5 rounded-full border border-line/60 bg-panel/85 py-2 pl-2.5 pr-3.5 text-[12.5px] font-medium text-ink-secondary shadow-menu backdrop-blur-md transition-[opacity,transform] ease-out',
          isVisible
            ? 'translate-y-0 scale-100 opacity-100 duration-300 [transition-delay:250ms]'
            : 'translate-y-1 scale-[0.98] opacity-0 delay-0 duration-200',
        )}
      >
        <span className="relative h-4 w-4 flex-none">
          <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        </span>
        {label}
      </div>
    </div>
  )
}

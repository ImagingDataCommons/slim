import type * as React from 'react'

import { cn } from '../../../lib/utils'

/**
 * Non-blocking pill shown over the viewport while something loads: centered
 * while the slide has no image yet, at the bottom while overlays load over
 * an image the user is looking at. Fades in after a short delay so cached
 * data does not flash it.
 */
export function ViewportLoadingIndicator({
  isVisible,
  label,
  detail,
  placement = 'center',
}: {
  isVisible: boolean
  /** Announced to screen readers when it changes */
  label: string
  /** Shown after the label but not announced, e.g. a changing count */
  detail?: string
  placement?: 'center' | 'bottom'
}): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      data-placement={placement}
      className={cn(
        'pointer-events-none absolute z-10 grid justify-items-center',
        placement === 'center'
          ? 'inset-0 place-items-center'
          : '@container inset-x-0 bottom-0 px-4',
      )}
    >
      <div
        aria-hidden={!isVisible}
        className={cn(
          /**
           * Opaque rather than blurred: the slide behind it is redrawn while
           * it shows, and a backdrop blur would be redone on every frame
           */
          'flex items-center gap-2.5 rounded-full border border-line/60 bg-panel/95 py-2 pl-2.5 pr-3.5 text-12.5 font-medium text-ink-secondary shadow-menu transition-[opacity,translate,scale] ease-out',
          'max-w-full',
          /**
           * Between the scale bar and the overview map where the viewport is
           * wide enough, above them where it is not
           */
          placement === 'bottom' && 'mb-[7.5rem] @min-[52rem]:mb-4',
          isVisible
            ? 'translate-y-0 scale-100 opacity-100 duration-300 [transition-delay:250ms]'
            : 'translate-y-1 scale-[0.98] opacity-0 delay-0 duration-200',
        )}
      >
        <span className="relative h-4 w-4 flex-none">
          <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
          {/** Its own compositor layer, so it turns while the page is busy */}
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary will-change-transform" />
        </span>
        <span className="truncate">
          {label}
          {detail !== undefined && (
            <span aria-hidden className="tabular-nums text-ink-muted">
              {' · '}
              {detail}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

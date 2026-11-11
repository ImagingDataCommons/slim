import type * as React from 'react'

import { Button } from '../../../components/ui/button'
import { Icon, type IconName } from '../../../components/ui/icon'
import { cn } from '../../../lib/utils'

export type ViewerMessageStatus = 'error' | 'warning'

const STATUS_ICON: Record<ViewerMessageStatus, IconName> = {
  error: 'error',
  warning: 'warning',
}

export interface ViewerMessageProps {
  status: ViewerMessageStatus
  title: string
  description: string
  onRetry?: () => void
}

/** Explains, in place of the viewer, why there is nothing to display */
export function ViewerMessage({
  status,
  title,
  description,
  onRetry,
}: ViewerMessageProps): React.ReactElement {
  return (
    <div className="grid h-full w-full place-items-center bg-app p-6">
      <div
        role={status === 'error' ? 'alert' : 'status'}
        className="flex max-w-[520px] flex-col items-center gap-3 text-center"
      >
        <span
          className={cn(
            'grid h-11 w-11 place-items-center rounded-full',
            status === 'error'
              ? 'bg-destructive-soft text-destructive-text'
              : 'bg-warning-soft text-warning-text',
          )}
        >
          <Icon name={STATUS_ICON[status]} size={22} />
        </span>
        <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
        <p className="text-13 leading-relaxed text-ink-muted wrap-anywhere">
          {description}
        </p>
        {onRetry !== undefined && (
          <Button className="mt-1" onClick={onRetry}>
            <Icon name="refresh" size={16} />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

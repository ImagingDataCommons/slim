import type * as React from 'react'

import { cn } from '../lib/utils'
import { Icon } from './ui/icon'

interface InfoPageProps {
  type: 'error' | 'info' | 'warning'
  title?: string
  message?: string
}

const TONES: Record<InfoPageProps['type'], { icon: string; tile: string }> = {
  error: { icon: 'error', tile: 'bg-destructive-soft text-destructive-text' },
  warning: { icon: 'warning', tile: 'bg-warning-soft text-warning-text' },
  info: { icon: 'info', tile: 'bg-primary-soft text-primary' },
}

/** Full-page info/error display component. */
function InfoPage({ type, title, message }: InfoPageProps): React.ReactElement {
  const tone = TONES[type]
  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center bg-app">
      <div className="flex max-w-md flex-col items-center gap-3 px-4 text-center">
        <span
          className={cn(
            'grid h-14 w-14 place-items-center rounded-[14px]',
            tone.tile,
          )}
        >
          <Icon name={tone.icon} size={30} filled />
        </span>
        {title !== undefined && title !== '' && (
          <h1 className="text-[20px] font-semibold text-ink">{title}</h1>
        )}
        {message !== undefined && message !== '' && (
          <p className="text-[13px] text-ink-muted">{message}</p>
        )}
      </div>
    </div>
  )
}

export default InfoPage

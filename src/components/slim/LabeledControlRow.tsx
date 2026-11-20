import type * as React from 'react'
import { useId } from 'react'

import { cn } from '../../lib/utils'

export interface LabeledControlProps {
  'aria-labelledby': string
  'aria-describedby'?: string
}

export interface LabeledControlRowProps {
  label: string
  description?: string
  /** Prefer `comfortable` in Preferences; `compact` in Display options. */
  density?: 'comfortable' | 'compact'
  labelDisabled?: boolean
  className?: string
  children: (controlProps: LabeledControlProps) => React.ReactNode
}

/**
 * Label and description on the left, control on the right. Shared by
 * Preferences rows and Display-options switches.
 */
export function LabeledControlRow({
  label,
  description,
  density = 'comfortable',
  labelDisabled = false,
  className,
  children,
}: LabeledControlRowProps): React.ReactElement {
  const id = useId()
  const labelId = `${id}-label`
  const descriptionId = description !== undefined ? `${id}-desc` : undefined
  const isCompact = density === 'compact'
  return (
    <div
      className={cn(
        'flex items-center',
        isCompact
          ? 'gap-3 border-b border-line-row py-2.5'
          : 'gap-4 border-b border-line-soft py-3',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          id={labelId}
          className={cn(
            'font-medium',
            isCompact ? 'text-12.5' : undefined,
            labelDisabled ? 'text-ink-faint' : 'text-ink',
          )}
        >
          {label}
        </div>
        {description !== undefined && (
          <div
            id={descriptionId}
            className={cn(
              'mt-0.5 text-ink-muted',
              isCompact ? 'text-11.5' : 'text-12',
            )}
          >
            {description}
          </div>
        )}
      </div>
      {children({
        'aria-labelledby': labelId,
        'aria-describedby': descriptionId,
      })}
    </div>
  )
}

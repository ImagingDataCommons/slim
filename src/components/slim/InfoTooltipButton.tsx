import type * as React from 'react'

import { cn } from '../../lib/utils'
import { Icon } from '../ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

interface InfoTooltipButtonProps {
  /** Accessible name, e.g. "Details for Nuclei" */
  label: string
  attributes: Array<{ name: string; value: string }>
  className?: string
}

/** Focusable info button revealing key/value details in a tooltip. */
export function InfoTooltipButton({
  label,
  attributes,
  className,
}: InfoTooltipButtonProps): React.ReactElement | null {
  if (attributes.length === 0) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'grid h-7 w-7 flex-none place-items-center rounded-md text-ink-faint transition-colors hover:bg-segmented hover:text-ink-secondary',
            className,
          )}
        >
          <Icon name="info" size={16} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" align="start" className="max-w-[280px]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 py-0.5 font-normal">
          {attributes.map((attribute) => (
            <div
              key={`${attribute.name}:${attribute.value}`}
              className="contents"
            >
              <dt className="opacity-70">{attribute.name}</dt>
              <dd className="break-words">{attribute.value}</dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  )
}

export default InfoTooltipButton

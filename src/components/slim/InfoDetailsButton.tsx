import type * as React from 'react'

import { cn } from '../../lib/utils'
import type { KeyValueItem } from '../../utils/keyValue'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { SlimKeyValueGrid } from './SlimKeyValueGrid'

export interface InfoDetailsButtonProps {
  /** Accessible name, e.g. "Details for Nuclei" */
  label: string
  items: KeyValueItem[]
  className?: string
}

/**
 * Info button revealing key/value details in a popover, so the details are
 * reachable by click, tap and keyboard alike.
 */
export function InfoDetailsButton({
  label,
  items,
  className,
}: InfoDetailsButtonProps): React.ReactElement | null {
  if (items.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          title={label}
          className={cn(
            'flex-none text-ink-faint hover:bg-segmented hover:text-ink-secondary',
            className,
          )}
        >
          <Icon name="info" size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-auto max-w-[280px] px-3 py-2 text-12"
      >
        <SlimKeyValueGrid
          items={items}
          className="grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 [&>div]:text-12"
        />
      </PopoverContent>
    </Popover>
  )
}

export default InfoDetailsButton

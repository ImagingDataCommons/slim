import type * as React from 'react'

import { cn } from '../../lib/utils'
import type { KeyValueItem } from '../../utils/keyValue'
import { withOccurrenceKeys } from '../../utils/occurrenceKeys'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

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
        className="w-auto max-w-[280px] px-3 py-2 text-[12px]"
      >
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
          {withOccurrenceKeys(items, (item) => item.label).map(
            ({ item, key }) => (
              <div key={key} className="contents">
                <dt className="text-ink-muted">{item.label}</dt>
                <dd className="break-words text-ink">{item.value}</dd>
              </div>
            ),
          )}
        </dl>
      </PopoverContent>
    </Popover>
  )
}

export default InfoDetailsButton

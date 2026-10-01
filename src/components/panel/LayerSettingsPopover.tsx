import type * as React from 'react'

import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

export interface LayerSettingsPopoverProps {
  /** Name of the layer, used in the trigger's accessible name */
  label: string
  /** Trigger tooltip and accessible-name prefix */
  title?: string
  icon?: React.ComponentProps<typeof Icon>['name']
  disabled?: boolean
  contentClassName?: string
  children: React.ReactNode
}

/** Icon button opening a layer's display settings to the left of the panel. */
export function LayerSettingsPopover({
  label,
  title = 'Display settings',
  icon = 'tune',
  disabled = false,
  contentClassName = 'w-auto',
  children,
}: LayerSettingsPopoverProps): React.ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title={title}
          aria-label={`${title} for ${label}`}
          disabled={disabled}
          className="flex-none hover:bg-segmented hover:text-ink-secondary disabled:opacity-40"
        >
          <Icon name={icon} size={17} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className={contentClassName}>
        {children}
      </PopoverContent>
    </Popover>
  )
}

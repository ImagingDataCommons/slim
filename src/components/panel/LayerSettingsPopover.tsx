import * as React from 'react'

import { useLayoutMode } from '../../contexts/LayoutModeContext'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  SlimDialogHeader,
} from '../ui/dialog'
import { Icon, type IconName } from '../ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

export interface LayerSettingsPopoverProps {
  /** Name of the layer, used in the trigger's accessible name */
  label: string
  /** Trigger tooltip and accessible-name prefix */
  title?: string
  icon?: IconName
  disabled?: boolean
  contentClassName?: string
  children: React.ReactNode
}

const SettingsTrigger = React.forwardRef<
  HTMLButtonElement,
  {
    label: string
    title: string
    icon: IconName
    disabled?: boolean
  } & React.ComponentPropsWithoutRef<'button'>
>(({ label, title, icon, disabled, className, type: _type, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="ghost"
    size="icon-xs"
    title={title}
    aria-label={`${title} for ${label}`}
    disabled={disabled}
    className={cn(
      'flex-none hover:bg-segmented hover:text-ink-secondary disabled:opacity-40',
      className,
    )}
    {...props}
  >
    <Icon name={icon} size={17} />
  </Button>
))
SettingsTrigger.displayName = 'SettingsTrigger'

/** Icon button opening a layer's display settings to the left of the panel. */
export function LayerSettingsPopover({
  label,
  title = 'Display settings',
  icon = 'tune',
  disabled = false,
  contentClassName = 'w-auto',
  children,
}: LayerSettingsPopoverProps): React.ReactElement {
  const { overlayPanels } = useLayoutMode()

  if (overlayPanels) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <SettingsTrigger
            label={label}
            title={title}
            icon={icon}
            disabled={disabled}
          />
        </DialogTrigger>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <SlimDialogHeader icon={icon} title={`${title} for ${label}`} />
          <div className="overflow-auto px-4 py-3">{children}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <SettingsTrigger
          label={label}
          title={title}
          icon={icon}
          disabled={disabled}
        />
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className={contentClassName}>
        {children}
      </PopoverContent>
    </Popover>
  )
}

import * as SwitchPrimitives from '@radix-ui/react-switch'
import * as React from 'react'

import { cn } from '../../lib/utils'

const TRACK_SIZES = {
  sm: 'h-[18px] w-[30px]',
  default: 'h-[18px] w-8',
  lg: 'h-5 w-9',
}

const THUMB_SIZES = {
  sm: 'h-3.5 w-3.5 data-[state=checked]:translate-x-3',
  default: 'h-3.5 w-3.5 data-[state=checked]:translate-x-3.5',
  lg: 'h-4 w-4 data-[state=checked]:translate-x-4',
}

/**
 * Design switch. Panel rows use 32×18 (30×18 for `sm`), preference rows use
 * 36×20 (`lg`).
 */
const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    size?: 'default' | 'sm' | 'lg'
  }
>(({ className, size = 'default', ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed data-disabled:bg-line! data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-off',
      TRACK_SIZES[size],
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block rounded-full bg-white shadow-[0_1px_2px_rgba(15,26,42,0.25)] ring-0 transition-transform data-[state=unchecked]:translate-x-0',
        THUMB_SIZES[size],
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }

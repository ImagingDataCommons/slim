import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as React from 'react'
import { cn } from '../../lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-4 w-8 shrink-0 cursor-pointer items-center border border-neutral-300 bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007ea3] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[#007ea3] data-[state=checked]:bg-[#007ea3]',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-3 w-3 translate-x-0.5 bg-white shadow transition-transform data-[state=checked]:translate-x-[15px]" />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }

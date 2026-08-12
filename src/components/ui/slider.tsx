import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'
import { cn } from '../../lib/utils'

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const thumbCount = props.value?.length ?? props.defaultValue?.length ?? 1
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex w-full touch-none select-none items-center py-2',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow bg-neutral-200">
        <SliderPrimitive.Range className="absolute h-full bg-[#007ea3]" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_unused, index) => (
        <SliderPrimitive.Thumb
          // biome-ignore lint/suspicious/noArrayIndexKey: thumb count is fixed per slider instance
          key={index}
          className="block h-3.5 w-3.5 shrink-0 border border-[#007ea3] bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007ea3] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

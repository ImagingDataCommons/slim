import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'

import { cn } from '../../lib/utils'

type SliderProps = React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> & {
  /** Accessible names per thumb, e.g. ["Lower limit", "Upper limit"] */
  thumbLabels?: string[]
}

/**
 * The accessible `role="slider"` element is the Thumb, so `aria-label`
 * (single thumb) and `thumbLabels` (range) are applied there, not on Root.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      value,
      defaultValue,
      thumbLabels,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    const thumbCount = value?.length ?? defaultValue?.length ?? 1

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          'relative flex w-full touch-none select-none items-center',
          className,
        )}
        value={value}
        defaultValue={defaultValue}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-line">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount }, (_, index) => index).map(
          (index) => {
            const label =
              thumbLabels?.[index] ??
              (thumbCount === 1 || ariaLabel === undefined
                ? ariaLabel
                : `${ariaLabel} ${index + 1}`)
            return (
              <SliderPrimitive.Thumb
                key={`thumb-${index}`}
                aria-label={label}
                aria-labelledby={
                  label === undefined ? ariaLabelledBy : undefined
                }
                className="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-panel shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50"
              />
            )
          },
        )}
      </SliderPrimitive.Root>
    )
  },
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

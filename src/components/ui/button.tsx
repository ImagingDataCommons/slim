import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-13 font-medium transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-line-input bg-panel text-ink-body hover:bg-app hover:text-ink',
        /** Current item of a group of outline buttons, e.g. the active page */
        selected:
          'border border-primary bg-primary-soft font-semibold text-primary',
        secondary: 'bg-app text-ink-body hover:bg-segmented',
        ghost: 'text-ink-secondary hover:bg-app hover:text-ink',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-control px-3.5',
        sm: 'h-[30px] px-2.5 text-12.5',
        /** Inline actions inside cards and rows, e.g. copy buttons */
        xs: 'h-7 gap-1 rounded-md px-2 text-12',
        lg: 'h-10 px-5',
        icon: 'h-9 w-9',
        'icon-sm': 'size-control',
        'icon-xs': 'h-7 w-7 rounded-md',
        /** Square-ish pagination button that grows with the page number */
        page: 'h-[30px] min-w-[30px] rounded-md px-1.5 text-12.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }

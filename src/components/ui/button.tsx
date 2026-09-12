import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

/** Rounded corners to match Ant Design buttons used elsewhere in the app. */
const buttonVariants = cva(
  'dmv-ui inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#007ea3]',
  {
    variants: {
      variant: {
        primary: 'bg-[#007ea3] text-white hover:bg-[#00688a]',
        ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
      },
      size: {
        icon: 'h-8 w-8 rounded-full',
        sm: 'h-7 px-2 text-xs rounded',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'icon',
    },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export { Button, buttonVariants }

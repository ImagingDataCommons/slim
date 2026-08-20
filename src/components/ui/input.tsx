import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'number', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-7 w-full rounded border border-neutral-300 bg-white px-1.5 text-right text-xs text-neutral-800 shadow-sm outline-none transition-colors focus-visible:border-[#007ea3] focus-visible:ring-1 focus-visible:ring-[#007ea3] disabled:cursor-not-allowed disabled:opacity-50',
      '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }

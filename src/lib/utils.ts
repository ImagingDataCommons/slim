import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names using clsx and merges Tailwind classes intelligently.
 * This is the standard utility for all className composition in the app.
 *
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4' (px-4 wins)
 * cn('text-red-500', condition && 'text-blue-500') // conditional classes
 * cn(buttonVariants({ variant: 'primary' }), className) // with CVA variants
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Must list the custom scale keys of tailwind.config.js: tailwind-merge treats
 * an unknown `text-*` as a color and would drop the font size in favor of a
 * later `text-ink`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['11', '11.5', '12', '12.5', '13'],
      radius: ['card', 'tile'],
      spacing: ['control'],
    },
  },
})

/**
 * Combines class names using clsx and merges Tailwind classes intelligently.
 * This is the standard utility for all className composition in the app.
 *
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4' (px-4 wins)
 * cn('text-red-500', condition && 'text-blue-500') // conditional classes
 * cn(buttonVariants({ variant: 'outline' }), className) // with CVA variants
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

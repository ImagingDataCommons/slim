import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Must list the custom keys of the `@theme` block in src/styles/globals.css:
 * tailwind-merge treats an unknown `text-*` or `shadow-*` as a color and would
 * drop the font size or shadow in favor of a later `text-ink` or
 * `shadow-primary`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['11', '11.5', '12', '12.5', '13'],
      radius: ['card', 'tile'],
      shadow: [
        'segmented',
        'tool',
        'overlay',
        'menu',
        'modal',
        'selected-ring',
      ],
      spacing: ['control'],
    },
    /** `--width-*` and `--height-*` keys have no tailwind-merge theme group */
    classGroups: {
      w: [{ w: ['sidebar', 'sidebar-right'] }],
      h: [{ h: ['header', 'toolbar', 'footer'] }],
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

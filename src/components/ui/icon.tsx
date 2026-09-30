import * as React from 'react'

import { cn } from '../../lib/utils'

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Material Symbols Rounded ligature name, e.g. `format_list_bulleted` */
  name: string
  /** Glyph size in px */
  size?: number
  filled?: boolean
}

/** Material Symbols Rounded glyph used across the Slim v2 design. */
export const Icon = React.forwardRef<HTMLSpanElement, IconProps>(
  ({ name, size = 20, filled = false, className, style, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn('material-symbols-rounded', className)}
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size >= 22 ? 24 : 20}`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  ),
)
Icon.displayName = 'Icon'

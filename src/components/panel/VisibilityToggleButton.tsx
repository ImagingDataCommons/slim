import type * as React from 'react'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

export interface VisibilityToggleButtonProps {
  /** Name of the layer, e.g. "Nuclei"; the button is named "Show Nuclei" */
  label: string
  isVisible: boolean
  disabled?: boolean
  /** Tooltip; defaults to "Show/hide" */
  title?: string
  onChange: (isVisible: boolean) => void
  className?: string
}

/** Eye toggle used by every layer row; state is exposed via `aria-pressed`. */
export function VisibilityToggleButton({
  label,
  isVisible,
  disabled = false,
  title = 'Show/hide',
  onChange,
  className,
}: VisibilityToggleButtonProps): React.ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      title={title}
      aria-label={`Show ${label}`}
      aria-pressed={isVisible}
      disabled={disabled}
      onClick={() => onChange(!isVisible)}
      className={cn(
        'flex-none hover:bg-segmented disabled:opacity-40',
        isVisible
          ? 'text-ink-secondary hover:text-ink-secondary'
          : 'text-ink-fainter hover:text-ink-fainter',
        className,
      )}
    >
      <Icon name={isVisible ? 'visibility' : 'visibility_off'} size={18} />
    </Button>
  )
}

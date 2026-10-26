import * as React from 'react'

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { cn } from '../../lib/utils'
import { Button, type ButtonProps } from './button'
import { Icon } from './icon'

export interface CopyButtonProps
  extends Omit<ButtonProps, 'onClick' | 'children' | 'asChild'> {
  /** Text written to the clipboard; a function is called at click time */
  text: string | (() => string)
  /** Visible label before copying */
  label?: string
  iconSize?: number
  /** How long the "Copied" state stays, in ms */
  resetAfterMs?: number
}

/** Outline button that copies `text` and confirms with a "Copied" state. */
export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      text,
      label = 'Copy',
      iconSize = 15,
      resetAfterMs = 1500,
      variant = 'outline',
      size = 'xs',
      className,
      ...props
    },
    ref,
  ) => {
    const { copied, copy } = useCopyToClipboard(resetAfterMs)
    return (
      <>
        <Button
          ref={ref}
          type="button"
          variant={variant}
          size={size}
          onClick={() => {
            void copy(typeof text === 'function' ? text() : text)
          }}
          className={cn(className, copied && 'text-success hover:text-success')}
          {...props}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={iconSize} />
          {copied ? 'Copied' : label}
        </Button>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Copied to clipboard' : ''}
        </span>
      </>
    )
  },
)
CopyButton.displayName = 'CopyButton'

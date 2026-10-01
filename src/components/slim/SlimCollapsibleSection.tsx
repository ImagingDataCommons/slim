import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import type * as React from 'react'
import { useState } from 'react'

import { cn } from '../../lib/utils'
import { Icon } from '../ui/icon'

export function CountBadge({
  count,
  tone = 'neutral',
  className,
}: {
  count: React.ReactNode
  tone?: 'neutral' | 'primary'
  className?: string
}): React.ReactElement {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-[3px] text-[11px] font-semibold normal-case leading-none tracking-normal',
        tone === 'primary'
          ? 'bg-primary-soft text-primary'
          : 'bg-chip text-ink-secondary',
        className,
      )}
    >
      {count}
    </span>
  )
}

/** 1px separator drawn between panel sections */
export function PanelDivider({
  className,
}: {
  className?: string
}): React.ReactElement {
  return <div className={cn('mx-3.5 h-px flex-none bg-line-soft', className)} />
}

export interface SlimCollapsibleSectionProps {
  title: string
  /** Count badge shown at the right of the header */
  count?: number
  countTone?: 'neutral' | 'primary'
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  /**
   * Content padding: `default` is 2px 16px 14px, `indent` aligns content with
   * the title text (38px left), `none` leaves layout to the children.
   */
  padding?: 'default' | 'indent' | 'none'
  contentClassName?: string
  /** Render the section divider below the section */
  divider?: boolean
  /** Keep content in the DOM while collapsed (for imperatively rendered viewers) */
  keepMounted?: boolean
  /** Header controls rendered outside the toggle button (e.g. bulk actions) */
  actions?: React.ReactNode
  className?: string
}

const CONTENT_PADDING = {
  default: 'px-4 pb-3.5 pt-0.5',
  indent: 'pb-3.5 pl-[38px] pr-4 pt-0.5',
  none: '',
}

/** Collapsible side-panel section with the v2 uppercase header. */
export function SlimCollapsibleSection({
  title,
  count,
  countTone = 'neutral',
  defaultOpen = true,
  open,
  onOpenChange,
  children,
  padding = 'default',
  contentClassName,
  divider = true,
  keepMounted = false,
  actions,
  className,
}: SlimCollapsibleSectionProps): React.ReactElement {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isOpen = open ?? uncontrolledOpen
  const handleOpenChange = (next: boolean): void => {
    if (open === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const trigger = (
    <CollapsiblePrimitive.Trigger
      className={cn(
        'flex items-center gap-1.5 pb-2 pt-3 text-left text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary',
        actions === undefined ? 'w-full px-3.5' : 'min-w-0 flex-1 pl-3.5',
      )}
    >
      <Icon
        name={isOpen ? 'expand_more' : 'chevron_right'}
        size={18}
        className="text-ink-faint"
      />
      <span className="min-w-0 truncate">{title}</span>
      {count !== undefined && (
        <CountBadge count={count} tone={countTone} className="ml-auto" />
      )}
    </CollapsiblePrimitive.Trigger>
  )

  return (
    <>
      <CollapsiblePrimitive.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        className={className}
      >
        {actions === undefined ? (
          trigger
        ) : (
          <div className="flex items-center gap-1.5 pr-3.5">
            {trigger}
            <div className="flex flex-none items-center pb-2 pt-3">
              {actions}
            </div>
          </div>
        )}
        <CollapsiblePrimitive.Content
          forceMount={keepMounted ? true : undefined}
          className={keepMounted ? 'data-[state=closed]:hidden' : undefined}
        >
          <div className={cn(CONTENT_PADDING[padding], contentClassName)}>
            {children}
          </div>
        </CollapsiblePrimitive.Content>
      </CollapsiblePrimitive.Root>
      {divider && <PanelDivider />}
    </>
  )
}

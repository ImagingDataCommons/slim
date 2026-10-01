import type * as React from 'react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import { Icon } from '../ui/icon'
import { CountBadge } from './CountBadge'
import { PanelDivider } from './PanelDivider'

export { CountBadge } from './CountBadge'
export { PanelDivider } from './PanelDivider'

export interface SlimCollapsibleSectionProps {
  title: string
  /** Count badge shown at the right of the header */
  count?: number
  countTone?: 'neutral' | 'primary'
  defaultOpen?: boolean
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
  onOpenChange,
  children,
  padding = 'default',
  contentClassName,
  divider = true,
  keepMounted = false,
  className,
}: SlimCollapsibleSectionProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const handleOpenChange = (next: boolean): void => {
    setIsOpen(next)
    onOpenChange?.(next)
  }

  return (
    <>
      <Collapsible
        open={isOpen}
        onOpenChange={handleOpenChange}
        className={className}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3.5 pb-2 pt-3 text-left text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
          <Icon
            name={isOpen ? 'expand_more' : 'chevron_right'}
            size={18}
            className="text-ink-faint"
          />
          <span className="min-w-0 truncate">{title}</span>
          {count !== undefined && (
            <CountBadge count={count} tone={countTone} className="ml-auto" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent
          forceMount={keepMounted ? true : undefined}
          className={keepMounted ? 'data-[state=closed]:hidden' : undefined}
        >
          <div className={cn(CONTENT_PADDING[padding], contentClassName)}>
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {divider && <PanelDivider />}
    </>
  )
}

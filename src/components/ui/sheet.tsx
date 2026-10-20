import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'

import { cn } from '../../lib/utils'
import { Icon } from './icon'

const Sheet = DialogPrimitive.Root

const SheetTitle = DialogPrimitive.Title

const SheetDescription = DialogPrimitive.Description

const SheetClose = DialogPrimitive.Close

const SIDE_CLASSES = {
  left: 'inset-y-0 left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
  right:
    'inset-y-0 right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
} as const

export type SheetSide = keyof typeof SIDE_CLASSES

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-scrim/36 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:hidden motion-reduce:transition-none motion-reduce:animate-none',
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: SheetSide
}

/**
 * Full-height side sheet. `forceMount` keeps children in the tree so the
 * DMV label viewer survives open/close, matching the desktop `hidden` rail.
 */
const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = 'left', className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      forceMount
      className={cn(
        'fixed z-50 flex h-full w-[min(20rem,calc(100vw-3rem))] flex-col bg-panel text-ink shadow-modal outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-200 data-[state=closed]:pointer-events-none data-[state=closed]:invisible motion-reduce:transition-none motion-reduce:animate-none motion-reduce:data-[state=open]:fade-in-0 motion-reduce:data-[state=closed]:fade-out-0',
        'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        side === 'left' && 'pl-[env(safe-area-inset-left)]',
        side === 'right' && 'pr-[env(safe-area-inset-right)]',
        SIDE_CLASSES[side],
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = DialogPrimitive.Content.displayName

export interface SheetHeaderProps {
  title: string
  className?: string
}

/** Sheet title row with a 44px close target. */
function SheetHeader({
  title,
  className,
}: SheetHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-none items-center gap-2 border-b border-line-soft px-4 py-2.5',
        className,
      )}
    >
      <SheetTitle className="min-w-0 flex-1 text-[15px] font-semibold leading-[1.2] text-ink">
        {title}
      </SheetTitle>
      <SheetClose className="grid size-11 flex-none place-items-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40">
        <Icon name="close" size={20} />
        <span className="sr-only">Close</span>
      </SheetClose>
    </div>
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
}

import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'

import { cn } from '../../lib/utils'
import { Icon } from './icon'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-scrim/[0.36] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Render the default top-right close button */
    showClose?: boolean
  }
>(({ className, children, showClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 m-auto flex h-fit w-[calc(100vw-48px)] max-w-lg max-h-[calc(100vh-48px)] flex-col overflow-hidden rounded-[14px] border border-line bg-panel text-ink shadow-modal duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]',
        className,
      )}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink focus:outline-none">
          <Icon name="close" size={20} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-row items-center justify-end gap-2', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-[15px] font-semibold leading-[1.2] text-ink',
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-[12.5px] text-ink-muted', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

/**
 * Design modal header: 34px primary-soft icon tile, title + subtitle and a
 * 32px close button, separated from the body by a bottom border.
 */
function SlimDialogHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-none items-center gap-3 border-b border-line-soft pb-3.5 pl-5 pr-4 pt-4',
        className,
      )}
    >
      <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-primary-soft text-primary">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <DialogTitle>{title}</DialogTitle>
        {subtitle !== undefined ? (
          <DialogDescription className="mt-0.5">{subtitle}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{title}</DialogDescription>
        )}
      </div>
      {actions}
      <DialogPrimitive.Close className="grid h-8 w-8 flex-none place-items-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink focus:outline-none">
        <Icon name="close" size={20} />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </div>
  )
}

/** Design modal footer: subtle background, top border, right-aligned actions. */
function SlimDialogFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-none items-center justify-end gap-2 border-t border-line-soft bg-subtle px-4 py-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  SlimDialogFooter,
  SlimDialogHeader,
}

import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'

import { cn } from '../../lib/utils'
import { Icon, type IconName } from './icon'

const Dialog = DialogPrimitive.Root

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

/**
 * Pass `aria-describedby={undefined}` when the dialog renders no
 * DialogDescription (e.g. a SlimDialogHeader without subtitle).
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
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
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

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
    className={cn('text-12.5 text-ink-muted', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

const HEADER_TILE_TONES = {
  primary: 'bg-primary-soft text-primary',
  destructive: 'bg-destructive-soft text-destructive-text',
} as const

export type SlimDialogHeaderTone = keyof typeof HEADER_TILE_TONES

export interface SlimDialogHeaderProps {
  icon: IconName
  title: React.ReactNode
  /** Rendered as the dialog description; omit it only together with `aria-describedby={undefined}` on DialogContent */
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  /** Color of the icon tile */
  tone?: SlimDialogHeaderTone
  className?: string
}

/**
 * Design modal header: 34px icon tile, title + subtitle and a 32px close
 * button, separated from the body by a bottom border.
 */
function SlimDialogHeader({
  icon,
  title,
  subtitle,
  actions,
  tone = 'primary',
  className,
}: SlimDialogHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-none items-center gap-3 border-b border-line-soft pb-3.5 pl-5 pr-4 pt-4',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-control flex-none place-items-center rounded-tile',
          HEADER_TILE_TONES[tone],
        )}
      >
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <DialogTitle>{title}</DialogTitle>
        {subtitle !== undefined && (
          <DialogDescription className="mt-0.5">{subtitle}</DialogDescription>
        )}
      </div>
      {actions}
      <DialogPrimitive.Close className="grid h-8 w-8 flex-none place-items-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <Icon name="close" size={20} />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </div>
  )
}

export interface SlimDialogFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/** Design modal footer: subtle background, top border, right-aligned actions. */
function SlimDialogFooter({
  className,
  children,
  ...props
}: SlimDialogFooterProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-none items-center justify-end gap-2 border-t border-line-soft bg-subtle px-4 py-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SlimDialogFooter,
  SlimDialogHeader,
}

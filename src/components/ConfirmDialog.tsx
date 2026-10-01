import type * as React from 'react'
import { createRoot } from 'react-dom/client'

import { cn } from '../lib/utils'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SlimDialogFooter,
} from './ui/dialog'
import { Icon } from './ui/icon'

export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A reusable confirmation dialog component.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps): React.ReactElement {
  const isDestructive = variant === 'destructive'
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-[420px]">
        <div className="flex gap-3 px-5 pb-5 pt-[18px]">
          <span
            className={cn(
              'grid h-control w-control flex-none place-items-center rounded-tile',
              isDestructive
                ? 'bg-destructive-soft text-destructive-text'
                : 'bg-primary-soft text-primary',
            )}
          >
            <Icon name={isDestructive ? 'delete' : 'help'} size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
            <DialogTitle>{title}</DialogTitle>
            {description !== undefined && description !== null ? (
              <DialogDescription asChild>
                <div>{description}</div>
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
        </div>
        <SlimDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Settles the dialog opened by the last `showConfirmDialog` call, if open */
let settleOpenDialog: ((confirmed: boolean) => void) | undefined

/**
 * Shows a confirmation dialog outside the React tree and resolves with the
 * user's choice. Opening a new dialog cancels (resolves `false`) the one
 * still open, so every returned promise settles.
 */
export function showConfirmDialog(options: ConfirmOptions): Promise<boolean> {
  settleOpenDialog?.(false)
  return new Promise<boolean>((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let isSettled = false

    const settle = (confirmed: boolean): void => {
      if (isSettled) return
      isSettled = true
      if (settleOpenDialog === settle) settleOpenDialog = undefined
      root.unmount()
      container.remove()
      resolve(confirmed)
    }
    settleOpenDialog = settle

    root.render(
      <ConfirmDialog
        {...options}
        open
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />,
    )
  })
}

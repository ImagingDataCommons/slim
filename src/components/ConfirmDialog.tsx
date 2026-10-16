import type { ReactElement, ReactNode } from 'react'
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
  description?: ReactNode
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
}: ConfirmDialogProps): ReactElement {
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

/** User choice, or `superseded` when a newer dialog replaced this one */
export type ConfirmResult = 'confirm' | 'cancel' | 'superseded'

/** Settles the dialog opened by the last `showConfirmDialog` call, if open */
let settleOpenDialog: ((result: ConfirmResult) => void) | undefined

/**
 * Shows a confirmation dialog outside the React tree and resolves with the
 * user's choice. Opening a new dialog settles the previous promise as
 * `superseded` (not `cancel`) so callers do not treat replacement as denial.
 */
export function showConfirmDialog(
  options: ConfirmOptions,
): Promise<ConfirmResult> {
  settleOpenDialog?.('superseded')
  return new Promise<ConfirmResult>((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let isSettled = false

    const settle = (result: ConfirmResult): void => {
      if (isSettled) return
      isSettled = true
      if (settleOpenDialog === settle) settleOpenDialog = undefined
      root.unmount()
      container.parentNode?.removeChild(container)
      resolve(result)
    }
    settleOpenDialog = settle

    root.render(
      <ConfirmDialog
        {...options}
        open
        onConfirm={() => settle('confirm')}
        onCancel={() => settle('cancel')}
      />,
    )
  })
}

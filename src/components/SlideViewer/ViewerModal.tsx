import type React from 'react'

import { cn } from '../../lib/utils'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../ui/dialog'

type DialogContentProps = React.ComponentProps<typeof DialogContent>

export interface ViewerModalProps {
  isVisible: boolean
  /** Called for Escape, overlay clicks and the close button */
  onCancel: () => void
  icon: React.ComponentProps<typeof SlimDialogHeader>['icon']
  title: string
  subtitle: string
  /** Tailwind max-width class of the dialog, e.g. `max-w-[520px]` */
  widthClassName: string
  bodyClassName?: string
  footer: React.ReactNode
  onOpenAutoFocus?: DialogContentProps['onOpenAutoFocus']
  children: React.ReactNode
}

/** Dialog frame shared by the slide viewer's modals: header, body, footer. */
export function ViewerModal({
  isVisible,
  onCancel,
  icon,
  title,
  subtitle,
  widthClassName,
  bodyClassName = 'gap-4',
  footer,
  onOpenAutoFocus,
  children,
}: ViewerModalProps): React.ReactElement {
  return (
    <Dialog
      open={isVisible}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent
        className={widthClassName}
        onOpenAutoFocus={onOpenAutoFocus}
      >
        <SlimDialogHeader icon={icon} title={title} subtitle={subtitle} />
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-y-auto px-5 pb-5 pt-[18px]',
            bodyClassName,
          )}
        >
          {children}
        </div>
        <SlimDialogFooter>{footer}</SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

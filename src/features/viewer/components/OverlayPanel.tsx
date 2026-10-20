import type { ReactNode } from 'react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  type SheetSide,
} from '../../../components/ui/sheet'

export interface OverlayPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: SheetSide
  title: string
  children: ReactNode
}

/** Full-height study/slide sheet used when rails would steal canvas width. */
export function OverlayPanel({
  open,
  onOpenChange,
  side,
  title,
  children,
}: OverlayPanelProps): React.ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} aria-describedby={undefined}>
        <SheetHeader title={title} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

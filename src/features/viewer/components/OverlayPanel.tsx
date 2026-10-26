import { type ReactNode, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

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

/**
 * Full-height study/slide sheet used when rails would steal canvas width.
 *
 * Radix unmounts a closed dialog's portal, so the panel children render into a
 * host element owned here and that element is moved into the sheet while it is
 * open. Section state and the DMV label viewer survive open/close, matching
 * the desktop rail. Children mount only once the host is first attached, so
 * viewers inside them first render into a sized element, not a detached one.
 */
export function OverlayPanel({
  open,
  onOpenChange,
  side,
  title,
  children,
}: OverlayPanelProps): React.ReactElement {
  const [host] = useState(() => {
    const element = document.createElement('div')
    element.className = 'flex min-h-0 flex-1 flex-col overflow-hidden'
    return element
  })
  const [hasBeenAttached, setHasBeenAttached] = useState(false)
  const attachHost = useCallback(
    (slot: HTMLDivElement | null): void => {
      if (slot !== null) {
        slot.appendChild(host)
        setHasBeenAttached(true)
      } else {
        host.remove()
      }
    },
    [host],
  )
  return (
    <>
      {hasBeenAttached && createPortal(children, host)}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side={side} aria-describedby={undefined}>
          <SheetHeader title={title} />
          <div ref={attachHost} className="flex min-h-0 flex-1 flex-col" />
        </SheetContent>
      </Sheet>
    </>
  )
}

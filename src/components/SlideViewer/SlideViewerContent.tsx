import type React from 'react'
import { useEffect } from 'react'

import { cn } from '../../lib/utils'

interface SlideViewerContentProps {
  toolbar: React.ReactNode
  overlays: React.ReactNode
  footer: React.ReactNode
  cursor: string
  isFluorescence: boolean
  volumeViewportRef: React.RefObject<HTMLDivElement>
  /** Called (once per animation frame) when the viewport box changes size */
  onViewportResize: () => void
  children: React.ReactNode
}

/**
 * Center column of the viewer: toolbar, the DMV viewport with its floating
 * overlays, and the status footer.
 */
const SlideViewerContent: React.FC<SlideViewerContentProps> = ({
  toolbar,
  overlays,
  footer,
  cursor,
  isFluorescence,
  volumeViewportRef,
  onViewportResize,
  children,
}) => {
  useEffect(() => {
    const element = volumeViewportRef.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    let frameId: number | undefined
    const observer = new ResizeObserver(() => {
      if (frameId !== undefined) return
      frameId = requestAnimationFrame(() => {
        frameId = undefined
        onViewportResize()
      })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (frameId !== undefined) cancelAnimationFrame(frameId)
    }
  }, [volumeViewportRef, onViewportResize])

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {toolbar}
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden',
          isFluorescence ? 'bg-viewport-fluorescence' : 'bg-viewport',
        )}
      >
        <div
          className="absolute inset-0"
          style={{ cursor }}
          ref={volumeViewportRef}
        />
        {overlays}
      </div>
      {footer}
      {children}
    </section>
  )
}

export default SlideViewerContent

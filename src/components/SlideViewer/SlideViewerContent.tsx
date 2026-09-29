import { Layout } from 'antd'
import type React from 'react'

interface SlideViewerContentProps {
  toolbar: React.ReactNode
  /** Kept for call-site compatibility; height is flex-based now. */
  toolbarHeight?: string
  cursor: string
  volumeViewportRef: React.RefObject<HTMLDivElement>
  /** Overlaid on top of the viewport (e.g. a floating load-progress card). */
  loadIndicator?: React.ReactNode
  /** Called when the mouse leaves the viewport area. */
  onMouseLeaveViewport?: () => void
  children: React.ReactNode
}

/**
 * Main content area for the SlideViewer. Viewport flex-fills under the toolbar
 * so a mismatched toolbarHeight cannot leave empty space below the map (that
 * gap sat under the minimap/scale and looked like uneven bottom inset).
 */
const SlideViewerContent: React.FC<SlideViewerContentProps> = ({
  toolbar,
  cursor,
  volumeViewportRef,
  loadIndicator,
  onMouseLeaveViewport,
  children,
}) => {
  return (
    <Layout.Content
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {toolbar}

      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: onMouseLeave is passive (hides tooltip), not interactive */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            cursor,
          }}
          ref={volumeViewportRef}
          onMouseLeave={onMouseLeaveViewport}
        />
        {loadIndicator}
      </div>

      {children}
    </Layout.Content>
  )
}

export default SlideViewerContent

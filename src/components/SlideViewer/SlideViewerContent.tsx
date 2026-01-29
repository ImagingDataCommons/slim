import { Layout } from 'antd'
import type React from 'react'

interface SlideViewerContentProps {
  toolbar: React.ReactNode
  toolbarHeight: string
  cursor: string
  volumeViewportRef: React.RefObject<HTMLDivElement>
  children: React.ReactNode
}

/**
 * Main content area component for the SlideViewer
 */
const SlideViewerContent: React.FC<SlideViewerContentProps> = ({
  toolbar,
  toolbarHeight,
  cursor,
  volumeViewportRef,
  children,
}) => {
  return (
    <Layout.Content style={{ height: '100%' }}>
      {toolbar}

      <div
        style={{
          height: `calc(100% - ${toolbarHeight})`,
          overflow: 'hidden',
          cursor,
        }}
        ref={volumeViewportRef}
      />

      {children}
    </Layout.Content>
  )
}

export default SlideViewerContent

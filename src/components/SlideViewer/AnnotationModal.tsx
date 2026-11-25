import type React from 'react'

import { Button } from '../ui/button'
import { ViewerModal } from './ViewerModal'

export interface AnnotationModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  isOkDisabled: boolean
  children: React.ReactNode
}

/** Modal for choosing the finding and geometry before drawing an ROI. */
const AnnotationModal = ({
  isVisible,
  onOk,
  onCancel,
  isOkDisabled,
  children,
}: AnnotationModalProps): React.ReactElement => (
  <ViewerModal
    isVisible={isVisible}
    onCancel={onCancel}
    icon="polyline"
    title="Configure annotation"
    subtitle="Choose what you are about to draw"
    widthClassName="max-w-[520px]"
    bodyClassName="gap-3"
    footer={
      <>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onOk} disabled={isOkDisabled}>
          Start drawing
        </Button>
      </>
    }
  >
    {children}
  </ViewerModal>
)

export default AnnotationModal

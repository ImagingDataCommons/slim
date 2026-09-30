import type React from 'react'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../ui/dialog'

interface AnnotationModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  isOkDisabled: boolean
  children: React.ReactNode
}

/** Modal for choosing the finding and geometry before drawing an ROI. */
const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isVisible,
  onOk,
  onCancel,
  isOkDisabled,
  children,
}) => {
  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[520px]">
        <SlimDialogHeader
          icon="polyline"
          title="Configure annotation"
          subtitle="Choose what you are about to draw"
        />
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5 pt-[18px]">
          {children}
        </div>
        <SlimDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onOk} disabled={isOkDisabled}>
            Start drawing
          </Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AnnotationModal

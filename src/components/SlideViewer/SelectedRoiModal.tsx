import type React from 'react'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../ui/dialog'

interface SelectedRoiModalProps {
  isVisible: boolean
  onCancel: () => void
  children: React.ReactNode
}

/** Modal displaying details of the selected ROI. */
const SelectedRoiModal: React.FC<SelectedRoiModalProps> = ({
  isVisible,
  onCancel,
  children,
}) => {
  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[520px]">
        <SlimDialogHeader
          icon="polyline"
          title="Selected ROI"
          subtitle="Region of interest details"
        />
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-[18px]">
          {children}
        </div>
        <SlimDialogFooter>
          <Button onClick={onCancel}>Done</Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SelectedRoiModal

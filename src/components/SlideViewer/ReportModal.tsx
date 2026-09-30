import type React from 'react'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../ui/dialog'

interface ReportModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  children: React.ReactNode
}

/** Modal for verifying the structured report before saving ROIs. */
const ReportModal: React.FC<ReportModalProps> = ({
  isVisible,
  onOk,
  onCancel,
  children,
}) => {
  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[640px]">
        <SlimDialogHeader
          icon="save"
          title="Save annotations"
          subtitle="Verify the report before storing it on the server"
        />
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-[18px]">
          {children}
        </div>
        <SlimDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onOk}>Save</Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ReportModal

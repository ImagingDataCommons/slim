import type React from 'react'

import { Button } from '../ui/button'
import { ViewerModal } from './ViewerModal'

export interface ReportModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  children: React.ReactNode
}

/** Modal for verifying the structured report before saving ROIs. */
const ReportModal = ({
  isVisible,
  onOk,
  onCancel,
  children,
}: ReportModalProps): React.ReactElement => (
  <ViewerModal
    isVisible={isVisible}
    onCancel={onCancel}
    icon="save"
    title="Save annotations"
    subtitle="Verify the report before storing it on the server"
    widthClassName="max-w-[640px]"
    footer={
      <>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onOk}>Save</Button>
      </>
    }
  >
    {children}
  </ViewerModal>
)

export default ReportModal

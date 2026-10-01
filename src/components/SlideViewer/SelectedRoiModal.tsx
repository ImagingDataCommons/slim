import type React from 'react'

import { Button } from '../ui/button'
import { ViewerModal } from './ViewerModal'

export interface SelectedRoiModalProps {
  isVisible: boolean
  onCancel: () => void
  children: React.ReactNode
}

/** Modal displaying details of the selected ROI. */
const SelectedRoiModal = ({
  isVisible,
  onCancel,
  children,
}: SelectedRoiModalProps): React.ReactElement => (
  <ViewerModal
    isVisible={isVisible}
    onCancel={onCancel}
    icon="polyline"
    title="Selected ROI"
    subtitle="Region of interest details"
    widthClassName="max-w-[520px]"
    footer={<Button onClick={onCancel}>Done</Button>}
  >
    {children}
  </ViewerModal>
)

export default SelectedRoiModal

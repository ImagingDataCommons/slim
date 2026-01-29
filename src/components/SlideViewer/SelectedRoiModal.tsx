import { Modal, Space } from 'antd'
import type React from 'react'

interface SelectedRoiModalProps {
  isVisible: boolean
  onCancel: () => void
  children: React.ReactNode
}

/**
 * Modal component for displaying selected ROI information
 */
const SelectedRoiModal: React.FC<SelectedRoiModalProps> = ({
  isVisible,
  onCancel,
  children,
}) => {
  return (
    <Modal
      open={isVisible}
      title="Selected ROI"
      onCancel={onCancel}
      maskClosable
      footer={null}
    >
      <Space align="start" direction="vertical">
        {children}
      </Space>
    </Modal>
  )
}

export default SelectedRoiModal

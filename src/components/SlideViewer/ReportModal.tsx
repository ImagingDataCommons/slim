import React from 'react'
import { Modal } from 'antd'

interface ReportModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  children: React.ReactNode
}

/**
 * Modal component for verifying and saving reports
 */
const ReportModal: React.FC<ReportModalProps> = ({
  isVisible,
  onOk,
  onCancel,
  children
}) => {
  return (
    <Modal
      open={isVisible}
      title='Verify and save report'
      onOk={onOk}
      onCancel={onCancel}
      okText='Save'
    >
      {children}
    </Modal>
  )
}

export default ReportModal

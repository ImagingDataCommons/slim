import React from 'react'
import { Modal, Space } from 'antd'

interface AnnotationModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  isOkDisabled: boolean
  children: React.ReactNode
}

/**
 * Modal component for configuring annotations
 */
const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isVisible,
  onOk,
  onCancel,
  isOkDisabled,
  children
}) => {
  return (
    <Modal
      open={isVisible}
      title='Configure annotations'
      onOk={onOk}
      okButtonProps={{ disabled: isOkDisabled }}
      onCancel={onCancel}
      okText='Select'
    >
      <Space align='start' direction='vertical'>
        {children}
      </Space>
    </Modal>
  )
}

export default AnnotationModal

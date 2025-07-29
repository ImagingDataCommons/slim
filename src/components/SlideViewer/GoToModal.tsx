import React from 'react'
import { Modal, Space, InputNumber } from 'antd'
import { CheckOutlined, StopOutlined } from '@ant-design/icons'

interface GoToModalProps {
  isVisible: boolean
  onOk: () => void
  onCancel: () => void
  validXCoordinateRange: number[]
  validYCoordinateRange: number[]
  isSelectedXCoordinateValid: boolean
  isSelectedYCoordinateValid: boolean
  isSelectedMagnificationValid: boolean
  onXCoordinateSelection: (value: any) => void
  onYCoordinateSelection: (value: any) => void
  onMagnificationSelection: (value: any) => void
}

/**
 * Modal component for navigating to specific slide positions
 */
const GoToModal: React.FC<GoToModalProps> = ({
  isVisible,
  onOk,
  onCancel,
  validXCoordinateRange,
  validYCoordinateRange,
  isSelectedXCoordinateValid,
  isSelectedYCoordinateValid,
  isSelectedMagnificationValid,
  onXCoordinateSelection,
  onYCoordinateSelection,
  onMagnificationSelection
}) => {
  return (
    <Modal
      open={isVisible}
      title='Go to slide position'
      onOk={onOk}
      onCancel={onCancel}
      okText='Select'
    >
      <Space align='start' direction='vertical'>
        <InputNumber
          placeholder={
            '[' +
            `${validXCoordinateRange[0]}` +
            ', ' +
            `${validXCoordinateRange[1]}` +
            ']'
          }
          prefix='X Coordinate [mm]'
          onChange={onXCoordinateSelection}
          onPressEnter={onXCoordinateSelection}
          controls={false}
          addonAfter={
            isSelectedXCoordinateValid
              ? (
                <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                )
              : (
                <StopOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                )
          }
        />
        <InputNumber
          placeholder={
            '[' +
            `${validYCoordinateRange[0]}` +
            ', ' +
            `${validYCoordinateRange[1]}` +
            ']'
          }
          prefix='Y Coordinate [mm]'
          onChange={onYCoordinateSelection}
          onPressEnter={onYCoordinateSelection}
          controls={false}
          addonAfter={
            isSelectedYCoordinateValid
              ? (
                <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                )
              : (
                <StopOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                )
          }
        />
        <InputNumber
          placeholder='[0 - 40]'
          prefix='Magnification'
          onChange={onMagnificationSelection}
          onPressEnter={onMagnificationSelection}
          controls={false}
          addonAfter={
            isSelectedMagnificationValid
              ? (
                <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                )
              : (
                <StopOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                )
          }
        />
      </Space>
    </Modal>
  )
}

export default GoToModal

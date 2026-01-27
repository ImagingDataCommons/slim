import React, { useCallback } from 'react'
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
  onXCoordinateSelection: (value: number | string | null) => void
  onYCoordinateSelection: (value: number | string | null) => void
  onMagnificationSelection: (value: number | string | null) => void
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
  onMagnificationSelection,
}) => {
  const handleXCoordinateEnter = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      const target = event.target as HTMLInputElement
      onXCoordinateSelection(target.value !== '' ? Number(target.value) : null)
    },
    [onXCoordinateSelection],
  )

  const handleYCoordinateEnter = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      const target = event.target as HTMLInputElement
      onYCoordinateSelection(target.value !== '' ? Number(target.value) : null)
    },
    [onYCoordinateSelection],
  )

  const handleMagnificationEnter = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      const target = event.target as HTMLInputElement
      onMagnificationSelection(
        target.value !== '' ? Number(target.value) : null,
      )
    },
    [onMagnificationSelection],
  )

  return (
    <Modal
      open={isVisible}
      title="Go to slide position"
      onOk={onOk}
      onCancel={onCancel}
      okText="Select"
    >
      <Space align="start" direction="vertical">
        <InputNumber
          placeholder={
            '[' +
            `${validXCoordinateRange[0]}` +
            ', ' +
            `${validXCoordinateRange[1]}` +
            ']'
          }
          prefix="X Coordinate [mm]"
          onChange={onXCoordinateSelection}
          onPressEnter={handleXCoordinateEnter}
          controls={false}
          addonAfter={
            isSelectedXCoordinateValid ? (
              <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
            ) : (
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
          prefix="Y Coordinate [mm]"
          onChange={onYCoordinateSelection}
          onPressEnter={handleYCoordinateEnter}
          controls={false}
          addonAfter={
            isSelectedYCoordinateValid ? (
              <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
            ) : (
              <StopOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
            )
          }
        />
        <InputNumber
          placeholder="[0 - 40]"
          prefix="Magnification"
          onChange={onMagnificationSelection}
          onPressEnter={handleMagnificationEnter}
          controls={false}
          addonAfter={
            isSelectedMagnificationValid ? (
              <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
            ) : (
              <StopOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
            )
          }
        />
      </Space>
    </Modal>
  )
}

export default GoToModal

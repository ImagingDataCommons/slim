import React, { useCallback } from 'react'
import { Col, InputNumber, Row, Slider } from 'antd'

interface ColorSliderProps {
  color: number[]
  onChange: (color: number[]) => void
}

const ColorSlider: React.FC<ColorSliderProps> = ({ color, onChange }) => {
  const handleColorChange = useCallback(
    (index: number, value: number | null): void => {
      if (value !== null) {
        const newColor = [...color]
        newColor[index] = value
        onChange(newColor)
      }
    },
    [color, onChange],
  )

  const createChangeHandler = useCallback(
    (index: number) => {
      return (value: number | null) => handleColorChange(index, value)
    },
    [handleColorChange],
  )

  const colorLabels = ['Red', 'Green', 'Blue']

  return (
    <>
      {colorLabels.map((colorLabel, index) => (
        <Row key={colorLabel} justify="center" align="middle" gutter={[8, 8]}>
          <Col span={5}>{colorLabel}</Col>
          <Col span={14}>
            <Slider
              range={false}
              min={0}
              max={255}
              step={1}
              value={color[index]}
              onChange={createChangeHandler(index)}
            />
          </Col>
          <Col span={5}>
            <InputNumber
              min={0}
              max={255}
              size="small"
              style={{ width: '65px' }}
              value={color[index]}
              onChange={createChangeHandler(index)}
            />
          </Col>
        </Row>
      ))}
    </>
  )
}

export default ColorSlider

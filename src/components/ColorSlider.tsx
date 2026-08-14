import { Col, InputNumber, Row, Slider } from 'antd'
import type React from 'react'
import { useCallback } from 'react'

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
    <div style={{ padding: '0 8px 8px' }}>
      {colorLabels.map((colorLabel, index) => (
        <div key={colorLabel} style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 4 }}>{colorLabel}</div>
          <Row gutter={8} align="middle">
            <Col span={18}>
              <Slider
                range={false}
                min={0}
                max={255}
                step={1}
                value={color[index]}
                onChange={createChangeHandler(index)}
              />
            </Col>
            <Col span={6}>
              <InputNumber
                min={0}
                max={255}
                size="small"
                style={{ width: '100%' }}
                value={color[index]}
                onChange={createChangeHandler(index)}
              />
            </Col>
          </Row>
        </div>
      ))}
    </div>
  )
}

export default ColorSlider

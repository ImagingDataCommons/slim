import React, { useCallback } from 'react'
import { Col, InputNumber, Row, Slider } from 'antd'

interface ColorSliderProps {
  color: number[]
  onChange: (color: number[]) => void
}

const ColorSlider: React.FC<ColorSliderProps> = ({ color, onChange }) => {
  const handleColorChange = useCallback((index: number, value: number | null): void => {
    if (value !== null) {
      const newColor = [...color]
      newColor[index] = value
      onChange(newColor)
    }
  }, [color, onChange])

  const colorLabels = ['Red', 'Green', 'Blue']

  return (
    <>
      {colorLabels.map((colorLabel, index) => (
        <Row key={colorLabel} justify='center' align='middle' gutter={[8, 8]}>
          <Col span={5}>
            {colorLabel}
          </Col>
          <Col span={14}>
            <Slider
              range={false}
              min={0}
              max={255}
              step={1}
              value={color[index]}
              onChange={(value) => handleColorChange(index, value)}
            />
          </Col>
          <Col span={5}>
            <InputNumber
              min={0}
              max={255}
              size='small'
              style={{ width: '65px' }}
              value={color[index]}
              onChange={(value) => handleColorChange(index, value)}
            />
          </Col>
        </Row>
      ))}
    </>
  )
}

export default ColorSlider

import React from 'react'
import { Col, InputNumber, Row, Slider } from 'antd'

interface OpacitySliderProps {
  opacity: number
  onChange: (opacity: number | null) => void
  label?: string
}

const OpacitySlider: React.FC<OpacitySliderProps> = ({ opacity, onChange, label = 'Opacity' }) => {
  return (
    <Row justify='center' align='middle'>
      <Col span={6}>
        {label}
      </Col>
      <Col span={12}>
        <Slider
          range={false}
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={onChange}
        />
      </Col>
      <Col span={6}>
        <InputNumber
          min={0}
          max={1}
          size='small'
          step={0.1}
          style={{ width: '65px' }}
          value={opacity}
          onChange={onChange}
        />
      </Col>
    </Row>
  )
}

export default OpacitySlider

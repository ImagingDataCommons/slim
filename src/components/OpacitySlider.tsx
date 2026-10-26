import { Col, InputNumber, Row, Slider } from 'antd'
import type React from 'react'

interface OpacitySliderProps {
  opacity: number
  onChange: (opacity: number | null) => void
  label?: string
}

const OpacitySlider: React.FC<OpacitySliderProps> = ({
  opacity,
  onChange,
  label = 'Opacity',
}) => {
  return (
    <div style={{ padding: '0 8px 8px' }}>
      <div style={{ marginBottom: 4 }}>{label}</div>
      <Row gutter={8} align="middle">
        <Col span={18}>
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
            size="small"
            step={0.1}
            style={{ width: '100%' }}
            value={opacity}
            onChange={onChange}
          />
        </Col>
      </Row>
    </div>
  )
}

export default OpacitySlider

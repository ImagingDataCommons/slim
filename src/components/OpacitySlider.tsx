import { InputNumber, Slider } from 'antd'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Slider
          range={false}
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={onChange}
          style={{ flex: 1, minWidth: 0 }}
        />
        <InputNumber
          min={0}
          max={1}
          size="small"
          step={0.1}
          style={{ width: '65px', flexShrink: 0 }}
          value={opacity}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

export default OpacitySlider

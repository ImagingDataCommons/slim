import type React from 'react'

import type { AnnotationStyle } from '../types/layerStyles'
import { toRGB } from '../utils/color'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
import { Switch } from './ui/switch'

export interface ColorSettingsMenuProps {
  style: AnnotationStyle
  /** Every change, including while dragging a slider */
  onChange: (style: AnnotationStyle) => void
  /** Final value: slider release, keyboard step, typed number or toggle */
  onCommit: (style: AnnotationStyle) => void
}

/** Color, opacity and outline settings of a set of annotations. */
function ColorSettingsMenu({
  style,
  onChange,
  onCommit,
}: ColorSettingsMenuProps): React.ReactElement {
  const color = toRGB(style.color)

  return (
    <div className="flex flex-col gap-4">
      {color !== undefined && (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-ink-muted">Color</span>
          <ColorSlider
            color={color}
            onChange={(next) => onChange({ ...style, color: next })}
            onCommit={(next) => onCommit({ ...style, color: next })}
          />
        </div>
      )}
      <OpacitySlider
        opacity={style.opacity}
        onChange={(opacity) => onChange({ ...style, opacity })}
        onCommit={(opacity) => onCommit({ ...style, opacity })}
      />
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-ink">Outline only</span>
        <Switch
          size="sm"
          checked={style.contourOnly}
          onCheckedChange={(contourOnly) => onCommit({ ...style, contourOnly })}
          aria-label="Show outline only"
        />
      </div>
    </div>
  )
}

export default ColorSettingsMenu

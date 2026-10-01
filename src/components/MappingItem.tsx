/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { memo } from 'react'

import { cn } from '../lib/utils'
import type { MappingStyle, MappingStyleChange } from '../types/layerStyles'
import { lutToCssGradient } from '../utils/lutGradient'
import {
  formatValueRange,
  getRealWorldValueRange,
} from '../utils/parametricMap'
import { areLayerItemPropsEqual } from '../utils/styleEquality'
import { InlineOpacityRow } from './panel/InlineOpacityRow'
import { useLayerStyle } from './panel/useLayerStyle'
import { VisibilityToggleButton } from './panel/VisibilityToggleButton'

export interface MappingItemProps {
  mapping: dmv.mapping.ParameterMapping
  metadata?: dmv.metadata.ParametricMap[]
  isVisible: boolean
  defaultStyle: MappingStyle
  onVisibilityChange: (change: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onStyleChange: (change: {
    mappingUID: string
    styleOptions: MappingStyleChange
  }) => void
}

/** One Real World Value Mapping with its value range and opacity. */
function MappingItem({
  mapping,
  metadata,
  isVisible,
  defaultStyle,
  onVisibilityChange,
  onStyleChange,
}: MappingItemProps): React.ReactElement {
  const [style, updateStyle, previewStyle] = useLayerStyle(
    { opacity: defaultStyle.opacity },
    (styleOptions) => onStyleChange({ mappingUID: mapping.uid, styleOptions }),
  )
  const valueRange = getRealWorldValueRange(metadata?.[0])
  const range =
    valueRange !== undefined ? formatValueRange(valueRange) : undefined
  const palette = defaultStyle.paletteColorLookupTable
  const gradient = palette !== undefined ? lutToCssGradient(palette) : ''
  const description = mapping.description?.trim() ?? ''

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-ink">
            {mapping.label}
          </span>
          {description !== '' && description !== mapping.label && (
            <span className="truncate text-12 text-ink-muted">
              {description}
            </span>
          )}
        </span>
        {range !== undefined && (
          <span className="flex-none text-12 text-ink-muted">{range}</span>
        )}
        <VisibilityToggleButton
          label={mapping.label}
          isVisible={isVisible}
          className="-my-1"
          onChange={(nextIsVisible) =>
            onVisibilityChange({
              mappingUID: mapping.uid,
              isVisible: nextIsVisible,
            })
          }
        />
      </div>
      <div
        className={cn(
          'h-2 rounded-sm',
          gradient === '' &&
            'border border-line bg-linear-to-r/srgb from-panel to-ink-muted',
        )}
        style={gradient !== '' ? { background: gradient } : undefined}
      />
      <InlineOpacityRow
        label={mapping.label}
        opacity={style.opacity}
        onChange={(opacity) => previewStyle({ opacity })}
        onCommit={(opacity) => updateStyle({ opacity })}
      />
    </div>
  )
}

export default memo(MappingItem, areLayerItemPropsEqual)

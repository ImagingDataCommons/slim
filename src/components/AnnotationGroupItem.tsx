/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { memo, useMemo, useState } from 'react'

import { cn } from '../lib/utils'
import type {
  AnnotationGroupStyle,
  AnnotationGroupStyleChange,
  RGB,
} from '../types/layerStyles'
import {
  describeAnnotationGroup,
  getAnnotationGroupItem,
  getMeasurementOptions,
  isFillableGraphicType,
} from '../utils/annotationGroup'
import { measurementOptionToConcept } from '../utils/annotationGroupMeasurement'
import { toRGB } from '../utils/color'
import { formatGroupedNumber } from '../utils/displayFormat'
import { toKeyValueItems } from '../utils/keyValue'
import { rgbToHex } from '../utils/segmentColors'
import { areLayerItemPropsEqual } from '../utils/styleEquality'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
import { LayerSettingsPopover } from './panel/LayerSettingsPopover'
import { useLayerStyle } from './panel/useLayerStyle'
import { VisibilityToggleButton } from './panel/VisibilityToggleButton'
import { InfoDetailsButton } from './slim/InfoDetailsButton'
import { Icon } from './ui/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Switch } from './ui/switch'
import ValidationWarning from './ValidationWarning'

const SETTINGS_LABEL = 'mb-2 text-[12px] text-ink-muted'
const NO_MEASUREMENT = '-'
const DEFAULT_FILL_OPACITY = 0.5

export interface AnnotationGroupItemProps {
  annotationGroup: dmv.annotation.AnnotationGroup
  isVisible: boolean
  metadata?: dmv.metadata.MicroscopyBulkSimpleAnnotations
  defaultStyle: AnnotationGroupStyle
  onAnnotationGroupClick: (annotationGroupUID: string) => void
  onVisibilityChange: (change: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onStyleChange: (change: {
    uid: string
    styleOptions: AnnotationGroupStyleChange
  }) => void
}

interface AnnotationGroupLocalStyle {
  opacity: number
  /** Only RGB colors can be edited */
  color?: RGB
  fill: boolean
  fillOpacity: number
}

function toEditableColor(color: readonly number[]): RGB | undefined {
  return color.length === 3 ? toRGB(color) : undefined
}

/** One annotation group with visibility, style and measurement coloring. */
function AnnotationGroupItem({
  annotationGroup,
  isVisible,
  metadata,
  defaultStyle,
  onAnnotationGroupClick,
  onVisibilityChange,
  onStyleChange,
}: AnnotationGroupItemProps): React.ReactElement {
  const uid = annotationGroup.uid
  const [style, updateStyle, previewStyle] =
    useLayerStyle<AnnotationGroupLocalStyle>(
      {
        opacity: defaultStyle.opacity,
        color: toEditableColor(defaultStyle.color),
        fill: defaultStyle.fill ?? false,
        fillOpacity: defaultStyle.fillOpacity ?? DEFAULT_FILL_OPACITY,
      },
      (styleOptions) => onStyleChange({ uid, styleOptions }),
    )
  /** Select value; survives the settings popover unmounting */
  const [measurementKey, setMeasurementKey] = useState(NO_MEASUREMENT)

  const item = getAnnotationGroupItem(metadata, uid)
  const { meta, attributes, count } = useMemo(
    () =>
      describeAnnotationGroup(
        annotationGroup,
        item,
        metadata?.AnnotationCoordinateType,
      ),
    [annotationGroup, item, metadata],
  )
  const details = useMemo(() => toKeyValueItems(attributes), [attributes])
  const measurementOptions = useMemo(() => getMeasurementOptions(item), [item])
  const isColoredByMeasurement = measurementKey !== NO_MEASUREMENT
  const isFillable = isFillableGraphicType(item?.GraphicType)
  const label = annotationGroup.label

  const handleMeasurementSelection = (key: string): void => {
    const option = measurementOptions.find((candidate) => candidate.key === key)
    setMeasurementKey(option?.key ?? NO_MEASUREMENT)
    if (option !== undefined) {
      onStyleChange({
        uid,
        styleOptions: { measurement: measurementOptionToConcept(option) },
      })
      return
    }
    const defaultColor = toRGB(defaultStyle.color)
    if (defaultColor === undefined) return
    previewStyle({ color: toEditableColor(defaultStyle.color) })
    onStyleChange({ uid, styleOptions: { color: defaultColor } })
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
      {isColoredByMeasurement ? (
        <span
          role="img"
          aria-label="Colored by measurement"
          title="Colored by measurement"
          className="flex flex-none text-ink-muted"
        >
          <Icon name="gradient" size={14} />
        </span>
      ) : (
        <span
          className={cn(
            'h-2.5 w-2.5 flex-none rounded-full',
            style.color === undefined && 'border border-line bg-panel',
          )}
          style={
            style.color !== undefined
              ? { background: rgbToHex(style.color) }
              : undefined
          }
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAnnotationGroupClick(uid)}
            className="min-w-0 truncate text-left font-semibold text-ink"
            title="Zoom to annotation group"
          >
            {label}
          </button>
          <ValidationWarning annotationGroup={annotationGroup} size={15} />
        </span>
        {meta !== '' && (
          <span className="truncate text-[12px] text-ink-muted">{meta}</span>
        )}
      </div>
      {count !== undefined && (
        <span className="flex-none font-mono text-[11.5px] font-medium text-ink-secondary">
          {formatGroupedNumber(count)}
        </span>
      )}
      <InfoDetailsButton label={`Details for ${label}`} items={details} />
      <LayerSettingsPopover label={label}>
        <div className="flex w-80 flex-col gap-4">
          <div className="text-[12.5px] font-semibold text-ink">
            Display settings
          </div>
          {style.color !== undefined && (
            <div>
              <p className={SETTINGS_LABEL}>Color</p>
              <ColorSlider
                color={style.color}
                onChange={(color) => previewStyle({ color })}
                onCommit={(color) => updateStyle({ color })}
              />
            </div>
          )}
          <OpacitySlider
            opacity={style.opacity}
            onChange={(opacity) => previewStyle({ opacity })}
            onCommit={(opacity) => updateStyle({ opacity })}
          />
          {isFillable && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-ink">Fill</span>
                <Switch
                  size="sm"
                  checked={style.fill}
                  onCheckedChange={(fill) => updateStyle({ fill })}
                  aria-label="Fill shapes"
                />
              </div>
              <OpacitySlider
                label="Fill opacity"
                opacity={style.fillOpacity}
                disabled={!style.fill}
                onChange={(fillOpacity) => previewStyle({ fillOpacity })}
                onCommit={(fillOpacity) => updateStyle({ fillOpacity })}
              />
            </div>
          )}
          {measurementOptions.length > 0 && (
            <div>
              <p className={SETTINGS_LABEL}>Color by measurement</p>
              <Select
                value={measurementKey}
                onValueChange={handleMeasurementSelection}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Color by measurement"
                >
                  <SelectValue placeholder="Select measurement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEASUREMENT}>None</SelectItem>
                  {measurementOptions.map((option) => (
                    <SelectItem
                      key={option.key}
                      value={option.key}
                      disabled={!isVisible}
                    >
                      {option.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </LayerSettingsPopover>
      <VisibilityToggleButton
        label={label}
        isVisible={isVisible}
        onChange={(nextIsVisible) =>
          onVisibilityChange({
            annotationGroupUID: uid,
            isVisible: nextIsVisible,
          })
        }
      />
    </div>
  )
}

export default memo(AnnotationGroupItem, areLayerItemPropsEqual)

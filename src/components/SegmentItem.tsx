/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { memo, useMemo } from 'react'

import { cn } from '../lib/utils'
import type {
  RGB,
  SegmentStyle,
  SegmentStyleChange,
} from '../types/layerStyles'
import { toRGB } from '../utils/color'
import { toKeyValueItems } from '../utils/keyValue'
import { describeSegment } from '../utils/segment'
import { getSegmentationType } from '../utils/segmentColors'
import { getSegmentSwatchBackground } from '../utils/segmentSwatch'
import { areLayerItemPropsEqual } from '../utils/styleEquality'
import ColorSlider from './ColorSlider'
import { InlineOpacityRow } from './panel/InlineOpacityRow'
import { LayerSettingsPopover } from './panel/LayerSettingsPopover'
import { useLayerStyle } from './panel/useLayerStyle'
import { VisibilityToggleButton } from './panel/VisibilityToggleButton'
import { InfoDetailsButton } from './slim/InfoDetailsButton'

/** Shown when the segment has no recommended display color */
const DEFAULT_SEGMENT_COLOR: RGB = [255, 255, 0]

export interface SegmentItemProps {
  segment: dmv.segment.Segment
  isVisible: boolean
  metadata?: dmv.metadata.Segmentation[]
  defaultStyle: SegmentStyle
  onVisibilityChange: (change: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onStyleChange: (change: {
    segmentUID: string
    styleOptions: SegmentStyleChange
  }) => void
  onClick: (segmentUID: string) => void
}

interface SegmentLocalStyle {
  opacity: number
  color: RGB
}

/** One segment with visibility, color and opacity controls. */
function SegmentItem({
  segment,
  isVisible: isVisibleProp,
  metadata,
  defaultStyle,
  onVisibilityChange,
  onStyleChange,
  onClick,
}: SegmentItemProps): React.ReactElement {
  /**
   * Opacity and color are committed separately: for FRACTIONAL segments,
   * sending a color would replace the distinct colormap with a flat LUT.
   */
  const [style, updateStyle, previewStyle] = useLayerStyle<SegmentLocalStyle>(
    {
      opacity: defaultStyle.opacity,
      color: toRGB(defaultStyle.color, DEFAULT_SEGMENT_COLOR),
    },
    (styleOptions) => onStyleChange({ segmentUID: segment.uid, styleOptions }),
  )

  /** Listed in the Segment Sequence but no frames contain it */
  const isAbsent = segment.isAbsent === true
  const isVisible = !isAbsent && isVisibleProp
  const segmentationType = getSegmentationType({
    SegmentationType: metadata?.[0]?.SegmentationType,
  })
  const isFractional = segmentationType === 'FRACTIONAL'
  const { meta, attributes } = useMemo(
    () => describeSegment(segment, segmentationType),
    [segment, segmentationType],
  )
  const details = useMemo(() => toKeyValueItems(attributes), [attributes])
  const swatch = getSegmentSwatchBackground({
    isFractional,
    color: style.color,
    palette: defaultStyle.paletteColorLookupTable,
  })
  const label = segment.label

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-3 w-3 flex-none rounded-[3px]',
            isAbsent && 'border border-dashed border-line-input',
            !isAbsent &&
              swatch === undefined &&
              'border border-line bg-linear-to-r/srgb from-panel to-ink-muted',
          )}
          style={
            isAbsent || swatch === undefined
              ? undefined
              : { background: swatch }
          }
        />
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left disabled:cursor-default"
          onClick={() => onClick(segment.uid)}
          disabled={isAbsent}
          title={
            isAbsent
              ? 'Segment is absent (no pixel data found)'
              : 'Zoom to segment'
          }
        >
          <span
            className={cn(
              'max-w-full truncate font-semibold',
              isAbsent ? 'text-ink-muted' : 'text-ink',
            )}
          >
            {label}
          </span>
          {meta !== '' && (
            <span className="max-w-full truncate text-12 text-ink-muted">
              {meta}
            </span>
          )}
          {isAbsent && (
            <span
              className="mt-0.5 rounded-full bg-chip px-1.5 py-[3px] text-11 font-semibold leading-none text-ink-secondary"
              title="Listed in Segment Sequence but no frames contain this segment"
            >
              Absent
            </span>
          )}
        </button>
        <InfoDetailsButton label={`Details for ${label}`} items={details} />
        {!isFractional && (
          <LayerSettingsPopover
            label={label}
            title="Segment color"
            icon="palette"
            disabled={isAbsent}
            contentClassName="w-80"
          >
            <div className="flex flex-col gap-2">
              <span className="text-12.5 font-semibold text-ink">Color</span>
              <ColorSlider
                color={style.color}
                onChange={(color) => previewStyle({ color })}
                onCommit={(color) => updateStyle({ color })}
              />
            </div>
          </LayerSettingsPopover>
        )}
        <VisibilityToggleButton
          label={label}
          isVisible={isVisible}
          disabled={isAbsent}
          title={isAbsent ? 'Segment has no pixel data' : undefined}
          onChange={(nextIsVisible) =>
            onVisibilityChange({
              segmentUID: segment.uid,
              isVisible: nextIsVisible,
            })
          }
        />
      </div>
      <InlineOpacityRow
        label={label}
        opacity={style.opacity}
        disabled={isAbsent}
        onChange={(opacity) => previewStyle({ opacity })}
        onCommit={(opacity) => updateStyle({ opacity })}
      />
    </div>
  )
}

export default memo(SegmentItem, areLayerItemPropsEqual)

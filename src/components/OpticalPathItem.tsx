/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { memo, useMemo } from 'react'

import { cn } from '../lib/utils'
import type {
  OpticalPathStyle,
  OpticalPathStyleChange,
  RGB,
} from '../types/layerStyles'
import { toRGB } from '../utils/color'
import {
  getOpticalPathMeta,
  getOpticalPathName,
  getOpticalPathSwatch,
} from '../utils/opticalPath'
import { getOpticalPathStyleSignature } from '../utils/opticalPathPartition'
import { getSpecimenStains } from '../utils/specimen'
import { areLayerItemPropsEqual } from '../utils/styleEquality'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
import { LayerSettingsPopover } from './panel/LayerSettingsPopover'
import { useFrameThrottledCallback } from './panel/useFrameThrottledCallback'
import { useLayerStyle } from './panel/useLayerStyle'
import { useLimitWindow } from './panel/useLimitWindow'
import { VisibilityToggleButton } from './panel/VisibilityToggleButton'
import { LimitInput } from './slim/LimitInput'
import { Button } from './ui/button'
import { Icon } from './ui/icon'
import { Slider } from './ui/slider'

const LIMIT_LABELS = ['Lower limit', 'Upper limit'] as const

export interface OpticalPathItemProps {
  opticalPath: dmv.opticalPath.OpticalPath
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  isVisible: boolean
  isRemovable: boolean
  hasIccProfile?: boolean
  defaultStyle: OpticalPathStyle
  onVisibilityChange: (change: {
    opticalPathIdentifier: string
    isVisible: boolean
  }) => void
  onStyleChange: (change: {
    opticalPathIdentifier: string
    styleOptions: OpticalPathStyleChange
  }) => void
  onRemoval: (opticalPathIdentifier: string) => void
}

interface OpticalPathLocalStyle {
  opacity: number
  color?: RGB
}

/**
 * One optical path of a multi-channel acquisition with control of its
 * visualization parameters.
 */
function OpticalPathItem({
  opticalPath,
  metadata,
  isVisible,
  isRemovable,
  hasIccProfile,
  defaultStyle,
  onVisibilityChange,
  onStyleChange,
  onRemoval,
}: OpticalPathItemProps): React.ReactElement {
  const identifier = opticalPath.identifier
  const commit = (styleOptions: OpticalPathStyleChange): void => {
    onStyleChange({ opticalPathIdentifier: identifier, styleOptions })
  }
  /**
   * The viewer also changes these styles (presentation states, pixel data
   * statistics), so local edits restart whenever the incoming values differ.
   */
  const resetKey = getOpticalPathStyleSignature(defaultStyle)
  const [style, updateStyle, previewStyle] =
    useLayerStyle<OpticalPathLocalStyle>(
      { opacity: defaultStyle.opacity, color: toRGB(defaultStyle.color) },
      commit,
      resetKey,
    )
  /** Windowing needs live feedback on the slide while dragging */
  const commitLive = useFrameThrottledCallback(commit)
  const previewLive = (change: OpticalPathStyleChange): void => {
    previewStyle(change)
    commitLive(change)
  }
  const maxValue = 2 ** (metadata[0]?.BitsAllocated ?? 8) - 1
  const limits = useLimitWindow({
    initial: defaultStyle.limitValues,
    min: 0,
    max: maxValue,
    onCommit: (limitValues) => commit({ limitValues }),
    onPreview: (limitValues) => commitLive({ limitValues }),
    resetKey,
  })

  const name = getOpticalPathName(opticalPath)
  const meta = useMemo(
    () =>
      getOpticalPathMeta(opticalPath, {
        hasIccProfile,
        stains: getSpecimenStains(metadata[0]?.SpecimenDescriptionSequence),
      }),
    [opticalPath, hasIccProfile, metadata],
  )
  const swatch = getOpticalPathSwatch(opticalPath, {
    color: style.color,
    paletteColorLookupTable: defaultStyle.paletteColorLookupTable,
  })
  const isMonochromatic = opticalPath.isMonochromatic

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-3 w-3 flex-none rounded-[3px] border border-ink/12',
            swatch === undefined && 'bg-panel',
          )}
          style={swatch !== undefined ? { background: swatch } : undefined}
        />
        <span
          className="max-w-[65%] flex-none truncate font-semibold text-ink"
          title={name}
        >
          {name}
        </span>
        {meta !== '' && (
          <span
            className="min-w-0 flex-1 truncate text-12 text-ink-muted"
            title={meta}
          >
            {meta}
          </span>
        )}
        <span className="ml-auto flex flex-none items-center gap-0.5">
          <LayerSettingsPopover label={name}>
            <div className="flex w-72 flex-col gap-4">
              <div className="text-12.5 font-semibold text-ink">
                Display settings
              </div>
              {isMonochromatic && limits.values !== undefined && (
                <div className="flex flex-col gap-2">
                  <div className="text-12 text-ink-muted">
                    Values of interest
                  </div>
                  <div className="flex items-center gap-2">
                    <LimitInput
                      integer
                      aria-label={LIMIT_LABELS[0]}
                      min={0}
                      max={limits.values[1]}
                      value={limits.values[0]}
                      onCommit={limits.commitLower}
                    />
                    <span className="text-ink-faint">–</span>
                    <LimitInput
                      integer
                      aria-label={LIMIT_LABELS[1]}
                      min={limits.values[0]}
                      max={maxValue}
                      value={limits.values[1]}
                      onCommit={limits.commitUpper}
                    />
                  </div>
                </div>
              )}
              {isMonochromatic && (
                <div className="flex flex-col gap-2">
                  <div className="text-12 text-ink-muted">Color</div>
                  {style.color !== undefined ? (
                    <ColorSlider
                      color={style.color}
                      onChange={(color) => previewLive({ color })}
                      onCommit={(color) => updateStyle({ color })}
                    />
                  ) : (
                    <p className="text-12 text-ink-secondary">
                      Pixels are colorized by the embedded palette color lookup
                      table, so custom pseudo-coloring is disabled.
                    </p>
                  )}
                </div>
              )}
              <OpacitySlider
                opacity={style.opacity}
                onChange={(opacity) => previewLive({ opacity })}
                onCommit={(opacity) => updateStyle({ opacity })}
              />
            </div>
          </LayerSettingsPopover>
          {isRemovable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Remove optical path"
              aria-label={`Remove ${name}`}
              onClick={() => onRemoval(identifier)}
              className="hover:bg-segmented hover:text-ink-secondary"
            >
              <Icon name="close" size={17} />
            </Button>
          )}
          <VisibilityToggleButton
            label={name}
            isVisible={isVisible}
            onChange={(nextIsVisible) =>
              onVisibilityChange({
                opticalPathIdentifier: identifier,
                isVisible: nextIsVisible,
              })
            }
          />
        </span>
      </div>
      {isMonochromatic && limits.values !== undefined && (
        <div className="flex items-center gap-2 text-11.5 text-ink-muted">
          Window
          <Slider
            className="flex-1"
            min={0}
            max={maxValue}
            step={1}
            value={limits.values}
            onValueChange={limits.preview}
            onValueCommit={limits.commit}
            thumbLabels={LIMIT_LABELS.map((label) => `${name} ${label}`)}
          />
        </div>
      )}
    </div>
  )
}

export default memo(OpticalPathItem, areLayerItemPropsEqual)

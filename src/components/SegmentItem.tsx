// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { cn } from '../lib/utils'
import { getSegmentationType, rgbToHex } from '../utils/segmentColors'
import ColorSlider from './ColorSlider'
import { Icon } from './ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Slider } from './ui/slider'

interface SegmentItemProps {
  segment: dmv.segment.Segment
  isVisible: boolean
  metadata: dmv.metadata.Segmentation[]
  defaultStyle: {
    opacity: number
    color?: number[]
  }
  onVisibilityChange: ({
    segmentUID,
    isVisible,
  }: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({
    segmentUID,
    styleOptions,
  }: {
    segmentUID: string
    styleOptions: {
      opacity: number
      color?: number[]
    }
  }) => void
  onClick: (segmentUID: string) => void
}

interface SegmentItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    color: number[]
  }
}

/**
 * React component representing a Segment.
 */
class SegmentItem extends React.Component<SegmentItemProps, SegmentItemState> {
  constructor(props: SegmentItemProps) {
    super(props)

    /** Initialize with default color if not provided */
    /** Yellow when the segment has no recommended display color */
    const defaultColor = this.props.defaultStyle.color ?? [255, 255, 0]
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: defaultColor,
      },
    }
  }

  handleVisibilityChange = (checked: boolean): void => {
    this.props.onVisibilityChange({
      segmentUID: this.props.segment.uid,
      isVisible: checked,
    })
    this.setState({ isVisible: checked })
  }

  handleColorChange = (newColor: number[]): void => {
    this.setState(
      (prevState) => {
        const newStyle = { ...prevState.currentStyle, color: newColor }
        return { currentStyle: newStyle }
      },
      () => {
        this.props.onStyleChange({
          segmentUID: this.props.segment.uid,
          styleOptions: {
            opacity: this.state.currentStyle.opacity,
            color: newColor,
          },
        })
      },
    )
  }

  handleOpacityChange = (opacity: number | null): void => {
    if (opacity !== null) {
      this.setState(
        (prevState) => {
          const newStyle = { ...prevState.currentStyle, opacity }
          return { currentStyle: newStyle }
        },
        () => {
          /**
           * Only send opacity - do not include color. For FRACTIONAL segments,
           * sending color would replace the distinct colormap with a flat LUT.
           * Color changes are handled separately by handleColorChange.
           */
          this.props.onStyleChange({
            segmentUID: this.props.segment.uid,
            styleOptions: {
              opacity,
            },
          })
        },
      )
    }
  }

  handleClick = (): void => {
    this.props.onClick(this.props.segment.uid)
  }

  render(): React.ReactNode {
    const { segment } = this.props
    const segmentationMetadata = this.props.metadata?.[0] as unknown as
      | Record<string, unknown>
      | undefined
    const segmentationType = getSegmentationType(segmentationMetadata)
    const isFractional = segmentationType === 'FRACTIONAL'
    const typeLabel =
      segmentationType.charAt(0) + segmentationType.slice(1).toLowerCase()
    const meta = [typeLabel, segment.algorithmName]
      .filter((part) => part !== undefined && part !== '')
      .join(' · ')
    const details = [
      `Property type: ${segment.propertyType.CodeMeaning}`,
      `Property category: ${segment.propertyCategory.CodeMeaning}`,
      `Algorithm: ${segment.algorithmName} (${segment.algorithmType})`,
    ].join('\n')
    const opacity = this.state.currentStyle.opacity

    return (
      <div className="flex flex-col gap-2.5 rounded-lg border border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 flex-none rounded-[3px]"
            style={{
              background: isFractional
                ? 'linear-gradient(90deg,#2c1b6b,#1f6fb0,#2fb08a,#e6d94a)'
                : rgbToHex(this.state.currentStyle.color),
            }}
          />
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
            onClick={this.handleClick}
            title={`${details}\n\nClick to zoom to segment`}
          >
            <span className="truncate font-semibold text-ink">
              {segment.label}
            </span>
            {meta !== '' && (
              <span className="truncate text-[12px] text-ink-muted">
                {meta}
              </span>
            )}
          </button>
          {!isFractional && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Segment color"
                  aria-label={`Color for ${segment.label}`}
                  className="grid h-7 w-7 flex-none place-items-center rounded-md text-ink-secondary transition-colors hover:bg-segmented"
                >
                  <Icon name="palette" size={17} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" align="start" className="w-80">
                <div className="flex flex-col gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">
                    Color
                  </span>
                  <ColorSlider
                    color={this.state.currentStyle.color}
                    onChange={this.handleColorChange}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
          <button
            type="button"
            title="Show/hide"
            aria-label={
              this.props.isVisible
                ? `Hide ${segment.label}`
                : `Show ${segment.label}`
            }
            onClick={() => this.handleVisibilityChange(!this.props.isVisible)}
            className={cn(
              'grid h-7 w-7 flex-none place-items-center rounded-md transition-colors hover:bg-segmented',
              this.props.isVisible ? 'text-ink-secondary' : 'text-ink-fainter',
            )}
          >
            <Icon
              name={this.props.isVisible ? 'visibility' : 'visibility_off'}
              size={18}
            />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
          Opacity
          <Slider
            className="flex-1"
            min={0}
            max={1}
            step={0.01}
            value={[opacity]}
            onValueChange={(values) => this.handleOpacityChange(values[0])}
            aria-label={`Opacity of ${segment.label}`}
          />
          <span className="w-9 text-right font-mono text-ink-body">
            {Math.round(opacity * 100)}%
          </span>
        </div>
      </div>
    )
  }
}

export default SegmentItem

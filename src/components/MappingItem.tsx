// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import { cn } from '../lib/utils'
import { Icon } from './ui/icon'
import { Slider } from './ui/slider'

interface RealWorldValueMapping {
  RealWorldValueFirstValueMapped?: number
  RealWorldValueLastValueMapped?: number
}

/** "0.0 – 1.0" from the first Real World Value Mapping item, if present. */
function getMappedValueRange(
  metadata: dmv.metadata.ParametricMap | undefined,
): string | undefined {
  const dataset = metadata as unknown as
    | {
        RealWorldValueMappingSequence?: RealWorldValueMapping[]
        SharedFunctionalGroupsSequence?: Array<{
          RealWorldValueMappingSequence?: RealWorldValueMapping[]
        }>
      }
    | undefined
  const item =
    dataset?.SharedFunctionalGroupsSequence?.[0]
      ?.RealWorldValueMappingSequence?.[0] ??
    dataset?.RealWorldValueMappingSequence?.[0]
  const first = item?.RealWorldValueFirstValueMapped
  const last = item?.RealWorldValueLastValueMapped
  if (typeof first !== 'number' || typeof last !== 'number') return undefined
  return `${first.toFixed(1)} – ${last.toFixed(1)}`
}

interface MappingItemProps {
  mapping: dmv.mapping.ParameterMapping
  metadata: dmv.metadata.ParametricMap[]
  isVisible: boolean
  defaultStyle: {
    opacity: number
  }
  onVisibilityChange: ({
    mappingUID,
    isVisible,
  }: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({
    mappingUID,
    styleOptions,
  }: {
    mappingUID: string
    styleOptions: {
      opacity?: number
    }
  }) => void
}

interface MappingItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
  }
}

/**
 * React component representing a Real World Value Mapping.
 */
class MappingItem extends React.Component<MappingItemProps, MappingItemState> {
  constructor(props: MappingItemProps) {
    super(props)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
      },
    }
  }

  handleVisibilityChange = (checked: boolean): void => {
    this.props.onVisibilityChange({
      mappingUID: this.props.mapping.uid,
      isVisible: checked,
    })
    this.setState({ isVisible: checked })
  }

  handleOpacityChange = (opacity: number | null): void => {
    if (opacity !== null) {
      this.props.onStyleChange({
        mappingUID: this.props.mapping.uid,
        styleOptions: {
          opacity,
        },
      })
      this.setState((_state) => ({
        currentStyle: {
          opacity,
        },
      }))
    }
  }

  render(): React.ReactNode {
    const { mapping } = this.props
    const range = getMappedValueRange(this.props.metadata?.[0])
    const opacity = this.state.currentStyle.opacity

    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="min-w-0 flex-1 truncate font-semibold text-ink"
            title={mapping.description}
          >
            {mapping.label}
          </span>
          {range !== undefined && (
            <span className="flex-none text-[12px] text-ink-muted">
              {range}
            </span>
          )}
          <button
            type="button"
            title="Show/hide"
            aria-label={
              this.props.isVisible
                ? `Hide ${mapping.label}`
                : `Show ${mapping.label}`
            }
            onClick={() => this.handleVisibilityChange(!this.props.isVisible)}
            className={cn(
              '-my-1 grid h-7 w-7 flex-none place-items-center rounded-md transition-colors hover:bg-segmented',
              this.props.isVisible ? 'text-ink-secondary' : 'text-ink-fainter',
            )}
          >
            <Icon
              name={this.props.isVisible ? 'visibility' : 'visibility_off'}
              size={18}
            />
          </button>
        </div>
        <div className="h-2 rounded bg-[linear-gradient(90deg,#2c1b6b,#1f6fb0,#2fb08a,#e6d94a)]" />
        <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
          Opacity
          <Slider
            className="flex-1"
            min={0}
            max={1}
            step={0.01}
            value={[opacity]}
            onValueChange={(values) => this.handleOpacityChange(values[0])}
            aria-label={`Opacity of ${mapping.label}`}
          />
          <span className="w-9 text-right font-mono text-ink-body">
            {Math.round(opacity * 100)}%
          </span>
        </div>
      </div>
    )
  }
}

export default MappingItem

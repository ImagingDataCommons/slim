/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import MappingItem from './MappingItem'
import { type DisplayOption, DisplayOptionsPanel } from './slim'

interface MappingDisplaySettings {
  interpolationEnabled: boolean
}

interface MappingListProps {
  mappings: dmv.mapping.ParameterMapping[]
  metadata: {
    [mappingUID: string]: dmv.metadata.ParametricMap[]
  }
  visibleMappingUIDs: Set<string>
  defaultMappingStyles: {
    [mappingUID: string]: { opacity: number }
  }
  onMappingVisibilityChange: ({
    mappingUID,
    isVisible,
  }: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onMappingStyleChange: ({
    mappingUID,
    styleOptions,
  }: {
    mappingUID: string
    styleOptions: {
      opacity?: number
    }
  }) => void
  /** Display settings for interpolation */
  displaySettings?: MappingDisplaySettings
  /** Callback when display settings change */
  onDisplaySettingsChange?: (settings: MappingDisplaySettings) => void
}

/**
 * React component representing a list of Real World Value Mappings.
 */
class MappingList extends React.Component<
  MappingListProps,
  Record<string, never>
> {
  render(): React.ReactNode {
    const items = this.props.mappings.map((mapping, _index) => {
      const uid = mapping.uid
      return (
        <MappingItem
          key={mapping.uid}
          mapping={mapping}
          metadata={this.props.metadata[uid]}
          isVisible={this.props.visibleMappingUIDs.has(uid)}
          defaultStyle={this.props.defaultMappingStyles[uid]}
          onVisibilityChange={this.props.onMappingVisibilityChange}
          onStyleChange={this.props.onMappingStyleChange}
        />
      )
    })

    /** Display options for interpolation */
    const displayOptions: DisplayOption[] = []

    if (this.props.displaySettings && this.props.onDisplaySettingsChange) {
      displayOptions.push({
        id: 'interpolation',
        label: 'Interpolation',
        shortLabel: 'Interp.',
        description: 'Smooth values between pixels.',
        enabled: this.props.displaySettings.interpolationEnabled,
        onChange: (enabled) => {
          this.props.onDisplaySettingsChange?.({
            interpolationEnabled: enabled,
          })
        },
      })
    }

    return (
      <div className="flex flex-col gap-1.5">
        {items}
        {displayOptions.length > 0 && (
          <DisplayOptionsPanel options={displayOptions} />
        )}
      </div>
    )
  }
}

export default MappingList

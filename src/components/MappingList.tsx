/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { buildMappingDisplayOptions } from '../utils/displayOptions'
import MappingItem from './MappingItem'
import {
  bindDisplayOptions,
  DisplayOptionsPanel,
} from './slim/DisplayOptionsPanel'

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
    [mappingUID: string]: {
      opacity: number
      paletteColorLookupTable?: { data: number[][] }
    }
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

    const { displaySettings, onDisplaySettingsChange } = this.props

    return (
      <div className="flex flex-col gap-1.5">
        {items}
        {displaySettings !== undefined &&
          onDisplaySettingsChange !== undefined && (
            <DisplayOptionsPanel
              options={bindDisplayOptions(
                buildMappingDisplayOptions(displaySettings),
                (id, enabled) => {
                  if (id === 'interpolation') {
                    onDisplaySettingsChange({
                      ...displaySettings,
                      interpolationEnabled: enabled,
                    })
                  }
                },
              )}
            />
          )}
      </div>
    )
  }
}

export default MappingList

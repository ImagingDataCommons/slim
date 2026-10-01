/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import type { MappingStyle, MappingStyleChange } from '../types/layerStyles'
import { buildMappingDisplayOptions } from '../utils/displayOptions'
import { bindDisplayOptions } from '../utils/displayOptionsBinding'
import MappingItem from './MappingItem'
import { DisplayOptionsPanel } from './slim/DisplayOptionsPanel'

export interface MappingDisplaySettings {
  interpolationEnabled: boolean
}

export interface MappingListProps {
  mappings: dmv.mapping.ParameterMapping[]
  metadata: {
    [mappingUID: string]: dmv.metadata.ParametricMap[]
  }
  visibleMappingUIDs: Set<string>
  defaultMappingStyles: {
    [mappingUID: string]: MappingStyle
  }
  onMappingVisibilityChange: (change: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onMappingStyleChange: (change: {
    mappingUID: string
    styleOptions: MappingStyleChange
  }) => void
  /** Display settings for interpolation */
  displaySettings?: MappingDisplaySettings
  /** Callback when display settings change */
  onDisplaySettingsChange?: (settings: MappingDisplaySettings) => void
}

/** Real World Value Mappings of the parametric maps of a slide. */
function MappingList({
  mappings,
  metadata,
  visibleMappingUIDs,
  defaultMappingStyles,
  onMappingVisibilityChange,
  onMappingStyleChange,
  displaySettings,
  onDisplaySettingsChange,
}: MappingListProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {mappings.map((mapping) => (
        <MappingItem
          key={mapping.uid}
          mapping={mapping}
          metadata={metadata[mapping.uid]}
          isVisible={visibleMappingUIDs.has(mapping.uid)}
          defaultStyle={defaultMappingStyles[mapping.uid]}
          onVisibilityChange={onMappingVisibilityChange}
          onStyleChange={onMappingStyleChange}
        />
      ))}
      {displaySettings !== undefined &&
        onDisplaySettingsChange !== undefined && (
          <DisplayOptionsPanel
            options={bindDisplayOptions(
              buildMappingDisplayOptions(displaySettings),
              displaySettings,
              { interpolation: 'interpolationEnabled' },
              onDisplaySettingsChange,
            )}
          />
        )}
    </div>
  )
}

export default MappingList

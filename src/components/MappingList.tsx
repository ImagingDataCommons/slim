/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import type { MappingStyle, MappingStyleChange } from '../types/layerStyles'
import { buildMappingDisplayOptions } from '../utils/displayOptions'
import { bindDisplayOptions } from '../utils/displayOptionsBinding'
import type { VisibilityChange } from '../utils/visibility'
import MappingItem from './MappingItem'
import { BulkVisibilityControl } from './slim/BulkVisibilityControl'
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
  /** "Show all" / "Hide all" in one pass; falls back to one call per item */
  onBulkMappingVisibilityChange?: (changes: VisibilityChange[]) => void
  onMappingStyleChange: (change: {
    mappingUID: string
    styleOptions: MappingStyleChange
  }) => void
  /** Live style while dragging; falls back to onMappingStyleChange */
  onMappingStylePreview?: (change: {
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
  onBulkMappingVisibilityChange,
  onMappingStyleChange,
  onMappingStylePreview,
  displaySettings,
  onDisplaySettingsChange,
}: MappingListProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <BulkVisibilityControl
        uids={mappings.map((mapping) => mapping.uid)}
        visibleUids={visibleMappingUIDs}
        itemLabel="parametric maps"
        onChange={(changes) => {
          if (onBulkMappingVisibilityChange !== undefined) {
            onBulkMappingVisibilityChange(changes)
            return
          }
          for (const { uid, isVisible } of changes) {
            onMappingVisibilityChange({ mappingUID: uid, isVisible })
          }
        }}
      />
      {mappings.map((mapping) => (
        <MappingItem
          key={mapping.uid}
          mapping={mapping}
          metadata={metadata[mapping.uid]}
          isVisible={visibleMappingUIDs.has(mapping.uid)}
          defaultStyle={defaultMappingStyles[mapping.uid]}
          onVisibilityChange={onMappingVisibilityChange}
          onStyleChange={onMappingStyleChange}
          onStylePreview={onMappingStylePreview}
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

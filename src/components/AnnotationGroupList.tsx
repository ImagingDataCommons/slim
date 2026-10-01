/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import type {
  AnnotationGroupStyle,
  AnnotationGroupStyleChange,
} from '../types/layerStyles'
import {
  buildAnnotationGroupDisplayOptions,
  buildClusteringThresholdInput,
} from '../utils/displayOptions'
import { bindDisplayOptions } from '../utils/displayOptionsBinding'
import AnnotationGroupItem from './AnnotationGroupItem'
import { BulkVisibilityControl } from './slim/BulkVisibilityControl'
import { DisplayOptionsPanel } from './slim/DisplayOptionsPanel'

export interface AnnotationGroupDisplaySettings {
  clusteringEnabled: boolean
  /** Raw text of the pixel size threshold field (mm); '' means zoom-based */
  clusteringThreshold: string
}

export interface AnnotationGroupListProps {
  annotationGroups: dmv.annotation.AnnotationGroup[]
  visibleAnnotationGroupUIDs: Set<string>
  metadata: {
    [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations
  }
  defaultAnnotationGroupStyles: {
    [annotationGroupUID: string]: AnnotationGroupStyle
  }
  onAnnotationGroupClick: (annotationGroupUID: string) => void
  onAnnotationGroupVisibilityChange: (change: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onAnnotationGroupStyleChange: (change: {
    uid: string
    styleOptions: AnnotationGroupStyleChange
  }) => void
  /** Clustering display settings; the panel is hidden when omitted */
  displaySettings?: AnnotationGroupDisplaySettings
  onDisplaySettingsChange?: (settings: AnnotationGroupDisplaySettings) => void
}

/** Annotation groups of bulk simple annotations with clustering options. */
function AnnotationGroupList({
  annotationGroups,
  visibleAnnotationGroupUIDs,
  metadata,
  defaultAnnotationGroupStyles,
  onAnnotationGroupClick,
  onAnnotationGroupVisibilityChange,
  onAnnotationGroupStyleChange,
  displaySettings,
  onDisplaySettingsChange,
}: AnnotationGroupListProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <BulkVisibilityControl
        itemLabel="annotation groups"
        uids={annotationGroups.map((group) => group.uid)}
        visibleUids={visibleAnnotationGroupUIDs}
        onChange={({ uid, isVisible }) =>
          onAnnotationGroupVisibilityChange({
            annotationGroupUID: uid,
            isVisible,
          })
        }
      />
      {annotationGroups.map((annotationGroup) => (
        <AnnotationGroupItem
          key={annotationGroup.uid}
          annotationGroup={annotationGroup}
          onAnnotationGroupClick={onAnnotationGroupClick}
          metadata={metadata[annotationGroup.uid]}
          isVisible={visibleAnnotationGroupUIDs.has(annotationGroup.uid)}
          defaultStyle={defaultAnnotationGroupStyles[annotationGroup.uid]}
          onVisibilityChange={onAnnotationGroupVisibilityChange}
          onStyleChange={onAnnotationGroupStyleChange}
        />
      ))}
      {displaySettings !== undefined &&
        onDisplaySettingsChange !== undefined && (
          <DisplayOptionsPanel
            options={bindDisplayOptions(
              buildAnnotationGroupDisplayOptions(displaySettings),
              displaySettings,
              { clustering: 'clusteringEnabled' },
              onDisplaySettingsChange,
            )}
            additionalInput={{
              ...buildClusteringThresholdInput(
                displaySettings.clusteringThreshold,
              ),
              onInputChange: (clusteringThreshold) =>
                onDisplaySettingsChange({
                  ...displaySettings,
                  clusteringThreshold,
                }),
            }}
          />
        )}
    </div>
  )
}

export default AnnotationGroupList

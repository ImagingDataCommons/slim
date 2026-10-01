/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import {
  buildAnnotationGroupDisplayOptions,
  buildClusteringThresholdInput,
} from '../utils/displayOptions'
import AnnotationGroupItem from './AnnotationGroupItem'
import { BulkVisibilityControl } from './slim/BulkVisibilityControl'
import {
  bindDisplayOptions,
  DisplayOptionsPanel,
} from './slim/DisplayOptionsPanel'

export interface AnnotationGroupDisplaySettings {
  clusteringEnabled: boolean
  /** Raw text of the pixel size threshold field (mm); '' means zoom-based */
  clusteringThreshold: string
}

interface AnnotationGroupListProps {
  annotationGroups: dmv.annotation.AnnotationGroup[]
  visibleAnnotationGroupUIDs: Set<string>
  metadata: {
    [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations
  }
  defaultAnnotationGroupStyles: {
    [annotationGroupUID: string]: {
      opacity: number
      color: number[]
      fill?: boolean
      fillOpacity?: number
    }
  }
  onAnnotationGroupClick: (annotationGroupUID: string) => void
  onAnnotationGroupVisibilityChange: ({
    annotationGroupUID,
    isVisible,
  }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onAnnotationGroupStyleChange: ({
    uid,
    styleOptions,
  }: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
      fill?: boolean
      fillOpacity?: number
    }
  }) => void
  /** Clustering display settings; the panel is hidden when omitted */
  displaySettings?: AnnotationGroupDisplaySettings
  onDisplaySettingsChange?: (settings: AnnotationGroupDisplaySettings) => void
}

/**
 * React component representing a list of Annotation Groups.
 */
class AnnotationGroupList extends React.Component<
  AnnotationGroupListProps,
  unknown
> {
  private renderDisplayOptions(): React.ReactNode {
    const { displaySettings, onDisplaySettingsChange } = this.props
    if (
      displaySettings === undefined ||
      onDisplaySettingsChange === undefined
    ) {
      return null
    }
    const options = bindDisplayOptions(
      buildAnnotationGroupDisplayOptions(displaySettings),
      (id, enabled) => {
        if (id === 'clustering') {
          onDisplaySettingsChange({
            ...displaySettings,
            clusteringEnabled: enabled,
          })
        }
      },
    )
    return (
      <DisplayOptionsPanel
        options={options}
        additionalInput={{
          ...buildClusteringThresholdInput(displaySettings.clusteringThreshold),
          onInputChange: (value) =>
            onDisplaySettingsChange({
              ...displaySettings,
              clusteringThreshold: value,
            }),
        }}
      />
    )
  }

  render(): React.ReactNode {
    return (
      <div className="flex flex-col gap-1.5">
        <BulkVisibilityControl
          uids={this.props.annotationGroups.map((group) => group.uid)}
          visibleUids={this.props.visibleAnnotationGroupUIDs}
          onChange={({ uid, isVisible }) =>
            this.props.onAnnotationGroupVisibilityChange({
              annotationGroupUID: uid,
              isVisible,
            })
          }
        />
        {this.props.annotationGroups.map((annotationGroup) => {
          const uid = annotationGroup.uid
          return (
            <AnnotationGroupItem
              key={uid}
              annotationGroup={annotationGroup}
              onAnnotationGroupClick={this.props.onAnnotationGroupClick}
              metadata={this.props.metadata[uid]}
              isVisible={this.props.visibleAnnotationGroupUIDs.has(uid)}
              defaultStyle={this.props.defaultAnnotationGroupStyles[uid]}
              onVisibilityChange={this.props.onAnnotationGroupVisibilityChange}
              onStyleChange={this.props.onAnnotationGroupStyleChange}
            />
          )
        })}
        {this.renderDisplayOptions()}
      </div>
    )
  }
}

export default AnnotationGroupList

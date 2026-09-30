/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import AnnotationGroupItem from './AnnotationGroupItem'

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
}

/**
 * React component representing a list of Annotation Groups.
 */
class AnnotationGroupList extends React.Component<
  AnnotationGroupListProps,
  unknown
> {
  render(): React.ReactNode {
    return (
      <div className="flex flex-col gap-1.5">
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
      </div>
    )
  }
}

export default AnnotationGroupList

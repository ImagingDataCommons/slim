import React from 'react'
import { Menu } from 'antd'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

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
    }
  }
  onAnnotationGroupVisibilityChange: ({ annotationGroupUID, isVisible }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onAnnotationGroupStyleChange: ({ uid, styleOptions }: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
    }
  }) => void
}

/**
 * React component representing a list of Annotation Groups.
 */
class AnnotationGroupList extends React.Component<AnnotationGroupListProps, {}> {
  render (): React.ReactNode {
    const items = this.props.annotationGroups.map((annotationGroup, index) => {
      const uid = annotationGroup.uid
      return (
        <AnnotationGroupItem
          key={annotationGroup.uid}
          annotationGroup={annotationGroup}
          metadata={this.props.metadata[uid]}
          isVisible={this.props.visibleAnnotationGroupUIDs.has(uid)}
          defaultStyle={this.props.defaultAnnotationGroupStyles[uid]}
          onVisibilityChange={this.props.onAnnotationGroupVisibilityChange}
          onStyleChange={this.props.onAnnotationGroupStyleChange}
        />
      )
    })

    return (
      <Menu selectable={false}>
        {items}
      </Menu>
    )
  }
}

export default AnnotationGroupList

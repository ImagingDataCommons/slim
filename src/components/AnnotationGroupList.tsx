import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import AnnotationGroupItem from './AnnotationGroupItem'

interface AnnotationGroupListProps {
  annotationGroups: dmv.annotation.AnnotationGroup[]
  visibleAnnotationGroupUIDs: string[]
  metadata: {
    [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations[]
  }
  defaultAnnotationGroupStyles: {
    [annotationGroupUID: string]: {
      opacity: number
    }
  }
  onAnnotationGroupVisibilityChange: ({ annotationGroupUID, isVisible }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onAnnotationGroupStyleChange: ({ annotationGroupUID, styleOptions }: {
    annotationGroupUID: string,
    styleOptions: {
      opacity: number
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
          isVisible={this.props.visibleAnnotationGroupUIDs.includes(uid)}
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

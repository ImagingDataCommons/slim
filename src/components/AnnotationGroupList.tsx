import React from 'react'
import { Menu, Switch } from 'antd'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

import AnnotationGroupItem from './AnnotationGroupItem'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

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
  handleVisibilityChange (
    checked: boolean
  ): void {
    if (checked) {
      this.props.annotationGroups.forEach(annotationGroup => {
        this.props.onAnnotationGroupVisibilityChange({ annotationGroupUID: annotationGroup.uid, isVisible: checked })
      })
    } else {
      this.props.visibleAnnotationGroupUIDs.forEach(annotationGroupUID => {
        this.props.onAnnotationGroupVisibilityChange({ annotationGroupUID, isVisible: checked })
      })
    }
  }

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
      <>

        <div style={{ paddingLeft: '14px', paddingTop: '7px', paddingBottom: '7px' }}>
          <Switch
            size='small'
            onChange={(checked: boolean) => this.handleVisibilityChange(checked)}
            checked={this.props.visibleAnnotationGroupUIDs.size > 0}
            checkedChildren={<FaEye />}
            unCheckedChildren={<FaEyeSlash />}
          />
        </div>
        <Menu selectable={false}>
          {items}
        </Menu>
      </>
    )
  }
}

export default AnnotationGroupList

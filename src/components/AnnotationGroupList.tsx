import React from 'react'
import { Menu, Switch } from 'antd'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
// skipcq: JS-C1003
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
  onAnnotationGroupClick: (annotationGroupUID: string) => void
  onAnnotationGroupVisibilityChange: ({
    annotationGroupUID,
    isVisible
  }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onAnnotationGroupStyleChange: ({
    uid,
    styleOptions
  }: {
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
class AnnotationGroupList extends React.Component<
AnnotationGroupListProps,
unknown
> {
  handleVisibilityChange = (checked: boolean): void => {
    if (checked) {
      this.props.annotationGroups.forEach((annotationGroup) => {
        this.props.onAnnotationGroupVisibilityChange({
          annotationGroupUID: annotationGroup.uid,
          isVisible: checked
        })
      })
      return
    }

    this.props.visibleAnnotationGroupUIDs.forEach((annotationGroupUID) => {
      this.props.onAnnotationGroupVisibilityChange({
        annotationGroupUID,
        isVisible: checked
      })
    })
  }

  render (): React.ReactNode {
    const items = this.props.annotationGroups.map((annotationGroup, index) => {
      const uid = annotationGroup.uid
      return (
        <AnnotationGroupItem
          key={annotationGroup.uid}
          annotationGroup={annotationGroup}
          onAnnotationGroupClick={this.props.onAnnotationGroupClick}
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
        <div
          style={{
            paddingLeft: '14px',
            paddingTop: '7px',
            paddingBottom: '7px'
          }}
        >
          <Switch
            size='small'
            onChange={this.handleVisibilityChange}
            checked={this.props.visibleAnnotationGroupUIDs.size > 0}
            checkedChildren={<FaEye />}
            unCheckedChildren={<FaEyeSlash />}
          />
        </div>
        <Menu selectable={false}>{items}</Menu>
      </>
    )
  }
}

export default AnnotationGroupList

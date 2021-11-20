import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu, Space, Switch } from 'antd'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'

interface AnnotationGroupItemProps {
  annotationGroup: dmv.annotation.AnnotationGroup
  isVisible: boolean
  metadata: dmv.metadata.MicroscopyBulkSimpleAnnotations[]
  defaultStyle: {
    opacity: number
  }
  onVisibilityChange: ({ annotationGroupUID, isVisible }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ annotationGroupUID, styleOptions }: {
    annotationGroupUID: string,
    styleOptions: {
      opacity: number
    }
  }) => void
}

interface AnnotationGroupItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
  }
}

/**
 * React component representing an Annotation Group.
 */
class AnnotationGroupItem extends React.Component<AnnotationGroupItemProps, AnnotationGroupItemState> {
  constructor (props: AnnotationGroupItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleOpacityChange = this.handleOpacityChange.bind(this)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: { opacity: this.props.defaultStyle.opacity }
    }
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    this.props.onVisibilityChange({
      annotationGroupUID: this.props.annotationGroup.uid,
      isVisible: checked
    })
  }

  handleOpacityChange (value: number): void {
    this.props.onStyleChange({
      annotationGroupUID: this.props.annotationGroup.uid,
      styleOptions: {
        opacity: value
      }
    })
    this.setState({ currentStyle: { opacity: value }})
  }

  render (): React.ReactNode {
    const identifier = `Annotation Group ${this.props.annotationGroup.number}`
    const attributes: Array<{ name: string, value: string }> = [
      {
        name: 'Label',
        value: this.props.annotationGroup.label
      },
      {
        name: 'Algorithm Name',
        value: this.props.annotationGroup.algorithmName
      },
      {
        name: 'Property category',
        value: this.props.annotationGroup.propertyCategory.CodeMeaning
      },
      {
        name: 'Property type',
        value: this.props.annotationGroup.propertyType.CodeMeaning
      }
    ]
    const { isVisible, onVisibilityChange, ...otherProps } = this.props
    return (
      <Space align='start'>
        <div style={{ paddingLeft: '14px' }}>
          <Switch
            size='small'
            onChange={this.handleVisibilityChange}
            checked={this.props.isVisible}
            checkedChildren={<FaEye />}
            unCheckedChildren={<FaEyeSlash />}
          />
        </div>
        <Menu.Item
          style={{ height: '100%' }}
          key={this.props.annotationGroup.uid}
          {...otherProps}
        >
          <Description
            header={identifier}
            attributes={attributes}
            selectable
            hasLongValues
          />
        </Menu.Item>
      </Space>
    )
  }
}

export default AnnotationGroupItem

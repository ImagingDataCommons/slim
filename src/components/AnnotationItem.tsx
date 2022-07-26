import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'
import { Menu, Space, Switch } from 'antd'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'

interface AnnotationItemProps {
  roi: dmv.roi.ROI
  index: number
  isVisible: boolean
  onVisibilityChange: ({ roiUID, isVisible }: {
    roiUID: string
    isVisible: boolean
  }) => void
}

/**
 * React component representing a Region of Interest (ROI) annotation.
 */
class AnnotationItem extends React.Component<AnnotationItemProps, {}> {
  constructor (props: AnnotationItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
  }

  handleVisibilityChange (
    checked: boolean,
    event: React.MouseEvent<HTMLButtonElement>
  ): void {
    this.props.onVisibilityChange({
      roiUID: this.props.roi.uid,
      isVisible: checked
    })
  }

  render (): React.ReactNode {
    const identifier = `ROI ${this.props.index + 1}`
    const attributes: Array<{ name: string, value: string }> = []
    /**
     * This hack is required for Menu.Item to work properly:
     * https://github.com/react-component/menu/issues/142
     */
    const { isVisible, onVisibilityChange, ...otherProps } = this.props
    this.props.roi.evaluations.forEach((
      item: (
        dcmjs.sr.valueTypes.TextContentItem |
        dcmjs.sr.valueTypes.CodeContentItem
      )
    ) => {
      const nameValue = item.ConceptNameCodeSequence[0].CodeValue
      const nameMeaning = item.ConceptNameCodeSequence[0].CodeMeaning
      const name = `${nameMeaning}`
      if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
        const codeContentItem = item as dcmjs.sr.valueTypes.CodeContentItem
        const valueMeaning = codeContentItem.ConceptCodeSequence[0].CodeMeaning
        // For consistency with Segment and Annotation Group
        if (nameValue === '276214006') {
          attributes.push({
            name: 'Property category',
            value: `${valueMeaning}`
          })
        } else if (nameValue === '121071') {
          attributes.push({
            name: 'Property type',
            value: `${valueMeaning}`
          })
        } else if (nameValue === '111001') {
          attributes.push({
            name: 'Algorithm Name',
            value: `${valueMeaning}`
          })
        } else {
          attributes.push({
            name: name,
            value: `${valueMeaning}`
          })
        }
      } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
        const textContentItem = item as dcmjs.sr.valueTypes.TextContentItem
        attributes.push({
          name: name,
          value: textContentItem.TextValue
        })
      }
    })
    this.props.roi.measurements.forEach(item => {
      const nameMeaning = item.ConceptNameCodeSequence[0].CodeMeaning
      const name = `${nameMeaning}`
      const seq = item.MeasuredValueSequence[0]
      const value = seq.NumericValue.toPrecision(6)
      const unit = seq.MeasurementUnitsCodeSequence[0].CodeValue
      attributes.push({
        name: name,
        value: `${value} ${unit}`
      })
    })
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
          style={{ height: '100%', paddingLeft: '3px' }}
          key={this.props.roi.uid}
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

export default AnnotationItem

import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'
import { Menu, Space, Switch } from 'antd'
import { FaEye, FaEyeSlash, FaRobot, FaUser } from 'react-icons/fa'

import Description from './Description'

interface AnnotationItemProps {
  roi: dmv.roi.ROI
  index: number
  isVisible: boolean
  onChangeVisibility: ({ roiUID }: { roiUID: string }) => void
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
    event: Event
  ): void {
    this.props.onChangeVisibility({ roiUID: this.props.roi.uid })
  }

  render (): React.ReactNode {
    const identifier = `ROI ${this.props.index + 1}`
    const attributes: Array<{ name: string, value: string }> = []
    /**
     * This hack is required for Menu.Item to work properly:
     * https://github.com/react-component/menu/issues/142
     */
    const { isVisible, onChangeVisibility, ...otherProps } = this.props
    this.props.roi.evaluations.forEach((
      item: (
        dcmjs.sr.valueTypes.TextContentItem |
        dcmjs.sr.valueTypes.CodeContentItem
      )
    ) => {
      const nameMeaning = item.ConceptNameCodeSequence[0].CodeMeaning
      const name = `${nameMeaning}`
      if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
        const codeConetentItem = item as dcmjs.sr.valueTypes.CodeContentItem
        const valueMeaning = codeConetentItem.ConceptCodeSequence[0].CodeMeaning
        attributes.push({
          name: name,
          value: `${valueMeaning}`
        })
      } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
        const textContentItem = item as dcmjs.sr.valueTypes.TextContentItem
        attributes.push({
          name: name,
          value: textContentItem.TextValue
        })
      }
    })
    this.props.roi.measurements.forEach(item => {
      console.info('add measurement: ', item)
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
    let icon = FaUser
    if (this.props.roi.properties.observerType === 'Device') {
      icon = FaRobot
    }
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
          key={this.props.roi.uid}
          {...otherProps}
        >
          <Description
            icon={icon}
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

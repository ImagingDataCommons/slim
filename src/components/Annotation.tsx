import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'
import { Menu } from 'antd'
import {
  FaRobot,
  FaUser
} from 'react-icons/fa'

import Description from './Description'

interface AnnotationProps {
  roi: dmv.roi.ROI
  index: number
}

class Annotation extends React.Component<AnnotationProps> {
  render (): React.ReactNode {
    const identifier = `Region ${this.props.index + 1}`
    const attributes: Array<{ name: string, value: string }> = []
    this.props.roi.evaluations.forEach((
      item: (
        dcmjs.sr.valueTypes.TextContentItem |
        dcmjs.sr.valueTypes.CodeContentItem
      )
    ) => {
      console.info('add qualitative evaluation: ', item)
      const nameMeaning = item.ConceptNameCodeSequence[0].CodeMeaning
      const name = `${nameMeaning}`
      if (item.ValueType === 'CODE') {
        const codeConetentItem = item as dcmjs.sr.valueTypes.CodeContentItem
        const valueMeaning = codeConetentItem.ConceptCodeSequence[0].CodeMeaning
        attributes.push({
          name: name,
          value: `${valueMeaning}`
        })
      } else if (item.ValueType === 'TEXT') {
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
      <Menu.Item
        style={{ height: '100%' }}
        key={this.props.roi.uid}
        {...this.props}
      >
        <Description
          icon={icon}
          header={identifier}
          attributes={attributes}
          hasLongValues
        />
      </Menu.Item>
    )
  }
}

export default Annotation

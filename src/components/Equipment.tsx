import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'

import Description from './Description'

interface EquipmentProps {
  metadata?: dmv.metadata.VLWholeSlideMicroscopyImage
}

/**
 * React component representing a list of DICOM Equipment Entities.
 */
class Equipment extends React.Component<EquipmentProps, {}> {
  render (): React.ReactNode {
    if (this.props.metadata === undefined) {
      return null
    }
    const attributes = [
      {
        name: 'Manufacturer',
        value: this.props.metadata.Manufacturer
      },
      {
        name: 'Model Name',
        value: this.props.metadata.ManufacturerModelName
      },
      {
        name: 'Device Serial Number',
        value: this.props.metadata.DeviceSerialNumber
      },
      {
        name: 'Software Versions',
        value: this.props.metadata.SoftwareVersions
      }
    ]
    if (this.props.metadata.InstitutionName != null) {
      attributes.push({
        name: 'Institution Name',
        value: this.props.metadata.InstitutionName
      })
    }
    return <Description attributes={attributes} hasLongValues />
  }
}

export default Equipment

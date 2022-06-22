import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'

import Description from './Description'
import { parseName, parseSex, parseDate } from '../utils/values'

interface PatientProps {
  metadata: dmv.metadata.Study|dmv.metadata.SOPClass
}

/**
 * React component representing a DICOM Patient Information Entity that
 * displays common study-level, patient-related attributes of contained
 * DICOM Slide Microscopy images.
 */
class Patient extends React.Component<PatientProps, {}> {
  render (): React.ReactNode {
    const attributes = [
      {
        name: 'ID',
        value: this.props.metadata.PatientID
      },
      {
        name: 'Name',
        value: parseName(this.props.metadata.PatientName)
      },
      {
        name: 'Gender',
        value: parseSex(this.props.metadata.PatientSex)
      },
      {
        name: 'Birthdate',
        value: parseDate(this.props.metadata.PatientBirthDate)
      }
    ]
    return (
      <Description attributes={attributes} />
    )
  }
}

export default Patient

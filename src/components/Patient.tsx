// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { parseDate, parseName, parseSex } from '../utils/values'
import Description from './Description'

interface PatientProps {
  metadata: dmv.metadata.Study | dmv.metadata.SOPClass
}

/**
 * React component representing a DICOM Patient Information Entity that
 * displays common study-level, patient-related attributes of contained
 * DICOM Slide Microscopy images.
 */
class Patient extends React.Component<PatientProps, Record<string, never>> {
  render(): React.ReactNode {
    const attributes = [
      {
        name: 'ID',
        value: this.props.metadata.PatientID,
      },
      {
        name: 'Name',
        value: parseName(this.props.metadata.PatientName),
      },
      {
        name: 'Sex',
        value: parseSex(this.props.metadata.PatientSex),
      },
      {
        name: 'Birthdate',
        value: parseDate(this.props.metadata.PatientBirthDate),
      },
      {
        name: 'Age',
        value: (this.props.metadata as unknown as Record<string, unknown>)
          .PatientAge as string | undefined,
      },
    ]
    return <Description attributes={attributes} />
  }
}

export default Patient

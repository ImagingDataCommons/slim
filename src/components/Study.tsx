// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { parseDate, parseTime } from '../utils/values'
import Description from './Description'

interface StudyProps {
  metadata: dmv.metadata.Study | dmv.metadata.SOPClass
}

/**
 * React component representing a DICOM Study Information Entity that displays
 * common study-level attributes of contained DICOM Slide Microscopy images.
 */
class Study extends React.Component<StudyProps> {
  render(): React.ReactNode {
    const attributes = [
      {
        name: 'Accession #',
        value: this.props.metadata.AccessionNumber,
      },
      {
        name: 'ID',
        value: this.props.metadata.StudyID,
      },
      {
        name: 'Date',
        value: parseDate(this.props.metadata.StudyDate),
      },
      {
        name: 'Time',
        value: parseTime(this.props.metadata.StudyTime),
      },
    ]
    return <Description attributes={attributes} />
  }
}

export default Study

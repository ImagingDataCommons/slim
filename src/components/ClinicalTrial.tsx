import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'

import Description from './Description'

interface ClinicalTrialProps {
  metadata: dmv.metadata.SOPClass
}

/**
 * React component representing a DICOM ClinicalTrial Information Entity that displays
 * common study-level attributes of contained DICOM Slide Microscopy images.
 */
class ClinicalTrial extends React.Component<ClinicalTrialProps> {
  render (): React.ReactNode {
    const attributes = []
    if (this.props.metadata.ClinicalTrialSponsorName != null) {
      // Attributes of Clinical Trial Subject module
      attributes.push(
        ...[
          {
            name: 'Sponsor Name',
            value: this.props.metadata.ClinicalTrialSponsorName
          },
          {
            name: 'Protocol ID',
            value: this.props.metadata.ClinicalTrialProtocolID
          },
          {
            name: 'Protocol Name',
            value: this.props.metadata.ClinicalTrialProtocolName
          },
          {
            name: 'Site Name',
            value: this.props.metadata.ClinicalTrialSiteName
          }
        ]
      )
    }
    if (this.props.metadata.ClinicalTrialTimePointID != null) {
      // Attributes of Clinical Trial Study module
      attributes.push(
        {
          name: 'Time Point ID',
          value: this.props.metadata.ClinicalTrialTimePointID
        }
      )
    }
    // Attributes of Clinical Trial Subject module
    return <Description attributes={attributes} />
  }
}

export default ClinicalTrial

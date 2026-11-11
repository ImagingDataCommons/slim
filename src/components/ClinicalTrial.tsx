/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import { type KeyValueItem, SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

interface ClinicalTrialProps {
  metadata: dmv.metadata.SOPClass
}

/**
 * Clinical trial information entity (Clinical Trial Subject and Clinical
 * Trial Study modules).
 */
function ClinicalTrial({ metadata }: ClinicalTrialProps): React.ReactElement {
  const items: KeyValueItem[] = []
  if (metadata.ClinicalTrialSponsorName != null) {
    items.push(
      { label: 'Sponsor', value: metadata.ClinicalTrialSponsorName },
      { label: 'Protocol ID', value: metadata.ClinicalTrialProtocolID },
      { label: 'Protocol', value: metadata.ClinicalTrialProtocolName },
      { label: 'Site', value: metadata.ClinicalTrialSiteName },
    )
  }
  if (metadata.ClinicalTrialTimePointID != null) {
    items.push({
      label: 'Time point',
      value: metadata.ClinicalTrialTimePointID,
    })
  }
  return <SlimKeyValueGrid items={items} />
}

export default ClinicalTrial

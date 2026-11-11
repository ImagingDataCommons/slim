/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import { formatPersonName, formatStudyDateTime } from '../utils/displayFormat'
import type { KeyValueItem } from '../utils/keyValue'
import { SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

export interface StudyProps {
  metadata: dmv.metadata.Study | dmv.metadata.SOPClass
}

/**
 * Study information entity: common study-level attributes of the contained
 * slide microscopy images.
 */
function Study({ metadata }: StudyProps): React.ReactElement {
  const description = metadata.StudyDescription
  const items: KeyValueItem[] = [
    { label: 'Study ID', value: metadata.StudyID },
    { label: 'Accession #', value: metadata.AccessionNumber },
    {
      label: 'Date',
      value: formatStudyDateTime(metadata.StudyDate, metadata.StudyTime),
    },
    {
      label: 'Referring',
      value: formatPersonName(metadata.ReferringPhysicianName),
    },
    ...(description !== undefined && description !== ''
      ? [{ label: 'Description', value: description }]
      : []),
  ]
  return <SlimKeyValueGrid items={items} />
}

export default Study

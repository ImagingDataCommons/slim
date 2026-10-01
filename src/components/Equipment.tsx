/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import { formatMultiValue } from '../utils/displayFormat'
import { type KeyValueItem, SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

interface EquipmentProps {
  metadata?: dmv.metadata.VLWholeSlideMicroscopyImage
}

/** General Equipment module of the slide's volume image. */
function Equipment({ metadata }: EquipmentProps): React.ReactElement | null {
  if (metadata === undefined) {
    return null
  }
  const items: KeyValueItem[] = [
    { label: 'Manufacturer', value: metadata.Manufacturer },
    { label: 'Model', value: metadata.ManufacturerModelName },
    { label: 'Serial #', value: metadata.DeviceSerialNumber },
    { label: 'Software', value: formatMultiValue(metadata.SoftwareVersions) },
  ]
  if (metadata.InstitutionName != null) {
    items.push({ label: 'Institution', value: metadata.InstitutionName })
  }
  return <SlimKeyValueGrid items={items} labelWidth={104} />
}

export default Equipment

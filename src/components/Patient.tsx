/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import {
  formatAdmittingDiagnoses,
  formatDisplayDate,
  formatPatientSpeciesCodeSequence,
  formatPersonName,
  formatSex,
} from '../utils/displayFormat'
import type { KeyValueItem } from '../utils/keyValue'
import { SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

export interface PatientProps {
  metadata: dmv.metadata.Study | dmv.metadata.SOPClass
}

/**
 * Patient information entity: study-level, patient-related attributes of the
 * contained slide microscopy images.
 */
function Patient({ metadata }: PatientProps): React.ReactElement {
  const species = formatPatientSpeciesCodeSequence(
    metadata.PatientSpeciesCodeSequence,
  )
  /** Spread copies the own dataset attributes, including non-standard keys */
  const admittingDiagnosis = formatAdmittingDiagnoses({ ...metadata })
  const age = metadata.PatientAge
  const items: KeyValueItem[] = [
    { label: 'Name', value: formatPersonName(metadata.PatientName) },
    { label: 'Patient ID', value: metadata.PatientID },
    {
      label: 'Birth date',
      value: formatDisplayDate(metadata.PatientBirthDate),
    },
    { label: 'Sex', value: formatSex(metadata.PatientSex) },
    ...(age !== undefined && age !== '' ? [{ label: 'Age', value: age }] : []),
    ...(species !== undefined ? [{ label: 'Species', value: species }] : []),
    ...(admittingDiagnosis !== undefined
      ? [{ label: 'Diagnosis', value: admittingDiagnosis }]
      : []),
  ]
  return <SlimKeyValueGrid items={items} />
}

export default Patient

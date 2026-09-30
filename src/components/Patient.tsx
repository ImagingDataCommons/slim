// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import {
  formatDisplayDate,
  formatPersonName,
  formatSex,
} from '../utils/displayFormat'
import {
  formatAdmittingDiagnoses,
  formatPatientSpeciesCodeSequence,
} from '../utils/values'
import { type KeyValueItem, SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

interface PatientProps {
  metadata: dmv.metadata.Study | dmv.metadata.SOPClass
}

/**
 * Patient information entity: study-level, patient-related attributes of the
 * contained slide microscopy images.
 */
function Patient({ metadata }: PatientProps): React.ReactElement {
  const meta = metadata as unknown as Record<string, unknown>
  const species = formatPatientSpeciesCodeSequence(
    meta.PatientSpeciesCodeSequence,
  )
  const admittingDiagnosis = formatAdmittingDiagnoses(meta)
  const age = meta.PatientAge as string | undefined
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

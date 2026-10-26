/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import {
  formatDisplayDate,
  formatPersonName,
} from '../../../utils/displayFormat'
import { getNumberOfSeries, normalizeModalities, orDash } from './studyFields'
import { sanitizeHiddenColumnIds } from './worklistColumns'

export interface WorklistCardFields {
  patientName: string
  patientId: string
  studyDate: string
  accession: string | undefined
  modalities: string[]
  /** Every series of the study (NumberOfStudyRelatedSeries) */
  series: number | undefined
}

/**
 * Curated study fields for the compact worklist card. Accession is omitted
 * only when the user hid that column; name / id / date always stay.
 */
export function buildWorklistCardFields(
  study: dmv.metadata.Study,
  hiddenColumnIds: readonly string[] = [],
): WorklistCardFields {
  const hidden = new Set(sanitizeHiddenColumnIds(hiddenColumnIds))
  const accession = study.AccessionNumber ?? ''
  return {
    patientName: orDash(formatPersonName(study.PatientName)),
    patientId: orDash(study.PatientID),
    studyDate: orDash(formatDisplayDate(study.StudyDate ?? '')),
    accession:
      hidden.has('AccessionNumber') || accession === '' ? undefined : accession,
    modalities: normalizeModalities(study.ModalitiesInStudy),
    series: getNumberOfSeries(study),
  }
}

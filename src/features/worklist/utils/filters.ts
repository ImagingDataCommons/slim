/**
 * Pure functions for filtering and searching study data.
 * No side effects - suitable for unit testing.
 */

/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { formatRawPersonName } from '../../../utils/dicom/personName'
import { formatPersonName } from '../../../utils/displayFormat'
import { normalizeModalities } from './studyFields'

/** Empty-state text of the worklist table, quoting the search query. */
export function getEmptyStudiesMessage(searchText = ''): string {
  const query = searchText.trim()
  return query === '' ? 'No studies found.' : `No studies match “${query}”.`
}

/**
 * Filters studies by search text across identifiers and the patient name,
 * matching both the displayed ("Doe, Jane") and raw ("Doe Jane") forms.
 */
export function filterStudiesBySearchText(
  studies: dmv.metadata.Study[],
  searchText: string,
): dmv.metadata.Study[] {
  const search = searchText.toLowerCase().trim()
  if (search === '') {
    return studies
  }

  return studies.filter((study) => {
    const fields: unknown[] = [
      study.AccessionNumber,
      study.StudyID,
      study.PatientID,
      formatPersonName(study.PatientName),
      formatRawPersonName(study.PatientName),
    ]

    return fields.some(
      (field) =>
        field !== undefined &&
        field !== null &&
        String(field).toLowerCase().includes(search),
    )
  })
}

/**
 * True when QIDO did not return usable ModalitiesInStudy.
 */
export function modalitiesNeedBackfill(study: dmv.metadata.Study): boolean {
  return normalizeModalities(study.ModalitiesInStudy).length === 0
}

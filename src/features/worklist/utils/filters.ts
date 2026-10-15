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

/** `studies` followed by the `extra` studies it does not already list. */
export function appendMissingStudies(
  studies: dmv.metadata.Study[],
  extra: dmv.metadata.Study[],
): dmv.metadata.Study[] {
  if (extra.length === 0) return studies
  const listed = new Set(studies.map((study) => study.StudyInstanceUID))
  const missing = extra.filter((study) => !listed.has(study.StudyInstanceUID))
  return missing.length === 0 ? studies : [...studies, ...missing]
}

/**
 * True when QIDO did not return usable ModalitiesInStudy.
 */
export function modalitiesNeedBackfill(study: dmv.metadata.Study): boolean {
  return normalizeModalities(study.ModalitiesInStudy).length === 0
}

/** Studies with ModalitiesInStudy filled in from `modalitiesByUid` where missing. */
export function mergeModalities(
  studies: dmv.metadata.Study[],
  modalitiesByUid: ReadonlyMap<string, string[]>,
): dmv.metadata.Study[] {
  if (modalitiesByUid.size === 0) return studies
  return studies.map((study) => {
    const modalities = modalitiesByUid.get(study.StudyInstanceUID)
    if (
      modalities === undefined ||
      modalities.length === 0 ||
      !modalitiesNeedBackfill(study)
    ) {
      return study
    }
    return { ...study, ModalitiesInStudy: modalities }
  })
}

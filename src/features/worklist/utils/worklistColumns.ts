/**
 * Worklist column ids in DOM order. Shared by layout shedding, the Columns
 * picker, and preferences validation.
 */
export const WORKLIST_COLUMN_IDS = [
  'PatientName',
  'PatientID',
  'PatientBirthDate',
  'PatientSex',
  'ModalitiesInStudy',
  'StudyDate',
  'StudyTime',
  'AccessionNumber',
  'StudyID',
  'ReferringPhysicianName',
  'Slides',
] as const

export type WorklistColumnId = (typeof WORKLIST_COLUMN_IDS)[number]

/** Cannot be hidden: opens the study. */
export const WORKLIST_LOCKED_COLUMN_ID: WorklistColumnId = 'PatientName'

export const WORKLIST_COLUMN_LABELS: Record<WorklistColumnId, string> = {
  PatientName: 'Patient name',
  PatientID: 'Patient ID',
  PatientBirthDate: 'Birth date',
  PatientSex: 'Sex',
  ModalitiesInStudy: 'Modality',
  StudyDate: 'Study date',
  StudyTime: 'Time',
  AccessionNumber: 'Accession #',
  StudyID: 'Study ID',
  ReferringPhysicianName: 'Referring physician',
  Slides: 'Series',
}

const KNOWN_IDS = new Set<string>(WORKLIST_COLUMN_IDS)

export function isWorklistColumnId(value: string): value is WorklistColumnId {
  return KNOWN_IDS.has(value)
}

/** Keep known ids only; drop duplicates and PatientName from a hidden list. */
export function sanitizeHiddenColumnIds(
  ids: readonly unknown[],
): WorklistColumnId[] {
  const seen = new Set<string>()
  const result: WorklistColumnId[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || !isWorklistColumnId(id)) continue
    if (id === WORKLIST_LOCKED_COLUMN_ID) continue
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

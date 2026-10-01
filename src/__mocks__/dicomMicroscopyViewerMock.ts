/**
 * Default stand-in for dicom-microscopy-viewer in unit tests (aliased in
 * vite.config.ts). Provides metadata.formatMetadata so Worklist and other
 * components can run; tests that need more call vi.mock themselves.
 */

interface DicomJsonElement {
  Value?: unknown[]
}

const TAG_TO_KEYWORD: Record<string, string> = {
  '0020000D': 'StudyInstanceUID',
  '00200010': 'StudyDescription',
  '00080050': 'AccessionNumber',
  '00080020': 'StudyDate',
  '00080030': 'StudyTime',
  '00100010': 'PatientName',
  '00100020': 'PatientID',
  '00100040': 'PatientSex',
  '00100030': 'PatientBirthDate',
  '00201206': 'NumberOfStudyRelatedSeries',
  '00201208': 'NumberOfStudyRelatedInstances',
  '00080061': 'ModalitiesInStudy',
  '00080060': 'Modality',
  '00080090': 'ReferringPhysicianName',
  '0020000E': 'SeriesInstanceUID',
}

function formatMetadata(metadata: unknown): {
  dataset: Record<string, unknown>
  bulkDataMapping: Record<string, unknown>
} {
  const dataset: Record<string, unknown> = {}
  if (metadata == null || typeof metadata !== 'object') {
    return { dataset, bulkDataMapping: {} }
  }
  const elements = metadata as Record<string, DicomJsonElement | undefined>
  for (const [tag, keyword] of Object.entries(TAG_TO_KEYWORD)) {
    const value = elements[tag]?.Value
    if (value != null) {
      dataset[keyword] = value.length === 1 ? value[0] : value
    }
  }
  return { dataset, bulkDataMapping: {} }
}

export const metadata = { formatMetadata }

// Mock for dicom-microscopy-viewer to resolve Jest test issues.
// Provides metadata.formatMetadata so Worklist and other components can run in tests.

const TAG_TO_KEYWORD = {
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
  '00080090': 'ReferringPhysicianName',
  '0020000E': 'SeriesInstanceUID'
}

function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { dataset: {}, bulkDataMapping: {} }
  }
  const dataset = {}
  for (const [tag, keyword] of Object.entries(TAG_TO_KEYWORD)) {
    if (metadata[tag] && metadata[tag].Value) {
      const value = metadata[tag].Value
      dataset[keyword] = value.length === 1 ? value[0] : value
    }
  }
  return { dataset, bulkDataMapping: {} }
}

const metadata = {
  formatMetadata
}

module.exports = {
  metadata
}

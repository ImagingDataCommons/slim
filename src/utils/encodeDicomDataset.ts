import { data } from 'dcmjs'

/** Explicit VR Little Endian */
export const EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1'

export interface EncodableDataset {
  SOPClassUID: string
  SOPInstanceUID: string
}

interface FileMetaElement {
  vr: string
  Value: Array<string | ArrayBuffer>
}

/** Denaturalized File Meta Information (group 0002) for a Part 10 file. */
export function buildFileMetaInformation(
  dataset: EncodableDataset,
  implementationClassUID: string,
): Record<string, FileMetaElement> {
  const version = new Uint8Array([0, 1])
  return {
    '00020001': { vr: 'OB', Value: [version.buffer] },
    '00020002': { vr: 'UI', Value: [dataset.SOPClassUID] },
    '00020003': { vr: 'UI', Value: [dataset.SOPInstanceUID] },
    '00020010': { vr: 'UI', Value: [EXPLICIT_VR_LITTLE_ENDIAN] },
    '00020012': { vr: 'UI', Value: [implementationClassUID] },
  }
}

/**
 * Encode a naturalized dataset (e.g. a dcmjs SR document) as a DICOM Part 10
 * buffer suitable for STOW-RS.
 */
export function encodeDicomDataset(
  dataset: EncodableDataset,
  implementationClassUID: string,
): ArrayBuffer {
  const writer = new data.DicomDict(
    buildFileMetaInformation(dataset, implementationClassUID),
  )
  writer.dict = data.DicomMetaDictionary.denaturalizeDataset(dataset)
  return writer.write()
}

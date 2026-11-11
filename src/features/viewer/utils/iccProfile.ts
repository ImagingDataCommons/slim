export interface IccProfileSource {
  OpticalPathSequence: ReadonlyArray<{ ICCProfile?: unknown }>
  /** Bulk data URIs keyed like the dataset; large ICC profiles live here */
  bulkdataReferences: object
}

function hasBulkdataIccProfile(bulkdataReferences: object): boolean {
  if (!('OpticalPathSequence' in bulkdataReferences)) return false
  const sequence = bulkdataReferences.OpticalPathSequence
  if (!Array.isArray(sequence)) return false
  const first: unknown = sequence[0]
  return typeof first === 'object' && first !== null && 'ICCProfile' in first
}

/**
 * Whether the first optical path of a color image carries an ICC profile,
 * inline or as a bulk data reference.
 */
export function hasIccProfile(image: IccProfileSource): boolean {
  const iccProfile = image.OpticalPathSequence[0]?.ICCProfile
  if (iccProfile !== null && iccProfile !== undefined) return true
  return hasBulkdataIccProfile(image.bulkdataReferences)
}

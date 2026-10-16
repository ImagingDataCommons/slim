/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'

import type DicomWebManager from '../../../DicomWebManager'
import type { Slide } from '../../../data/slides'
import { StorageClasses } from '../../../data/uids'
import { logger } from '../../../utils/logger'
import {
  isReferencingInstance,
  type ReferencingInstance,
  resolveReferencedSlide,
} from '../utils/referencedSlide'

const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary

export type DerivedSeriesResolution =
  | {
      kind: 'referenced'
      slide: Slide
      derivedDataset: ReferencingInstance
    }
  | { kind: 'unresolved' }

/**
 * Fetch series metadata and, when it references an image slide of the study,
 * return that slide and the naturalized derived instance.
 */
export async function resolveDerivedSeriesSlide({
  clients,
  slides,
  studyInstanceUID,
  seriesInstanceUID,
}: {
  clients: { [key: string]: DicomWebManager }
  slides: readonly Slide[]
  studyInstanceUID: string
  seriesInstanceUID: string
}): Promise<DerivedSeriesResolution> {
  try {
    const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    const derivedSeriesMetadata = await client.retrieveSeriesMetadata({
      studyInstanceUID,
      seriesInstanceUID,
    })
    const naturalizedDerivedMetadata = naturalizeDataset(
      derivedSeriesMetadata[0],
    )
    if (isReferencingInstance(naturalizedDerivedMetadata)) {
      const referencedSlide = resolveReferencedSlide(
        slides,
        naturalizedDerivedMetadata,
      )
      if (referencedSlide !== undefined) {
        return {
          kind: 'referenced',
          slide: referencedSlide,
          derivedDataset: naturalizedDerivedMetadata,
        }
      }
    }
    return { kind: 'unresolved' }
  } catch (error) {
    logger.warn(
      `Failed to resolve referenced slide for series "${seriesInstanceUID}"`,
      error,
    )
    return { kind: 'unresolved' }
  }
}

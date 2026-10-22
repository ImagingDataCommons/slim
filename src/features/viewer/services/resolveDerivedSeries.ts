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
 * Clients to ask for a derived series, the slide client first: a derived
 * series may live only on a store configured for its storage class (or the
 * `?gcp=` store), which the slide client does not read.
 */
function lookupClients(clients: {
  [key: string]: DicomWebManager
}): DicomWebManager[] {
  return [
    ...new Set([
      clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE],
      ...Object.values(clients),
    ]),
  ].filter((client) => client !== undefined)
}

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
  for (const client of lookupClients(clients)) {
    let derivedSeriesMetadata: Awaited<
      ReturnType<DicomWebManager['retrieveSeriesMetadata']>
    >
    try {
      derivedSeriesMetadata = await client.retrieveSeriesMetadata({
        studyInstanceUID,
        seriesInstanceUID,
      })
    } catch (error) {
      logger.warn(
        `Failed to retrieve metadata of series "${seriesInstanceUID}"`,
        error,
      )
      continue
    }
    if (derivedSeriesMetadata.length === 0) continue
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
    /** Found but references no slide of the study; other stores agree */
    logger.warn(
      `Series "${seriesInstanceUID}" references no slide of this study`,
    )
    return { kind: 'unresolved' }
  }
  return { kind: 'unresolved' }
}

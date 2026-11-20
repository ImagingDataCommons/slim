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
 * Metadata of the series from the first client, in lookup order, whose
 * stores have it. A search finds the series without failing on stores that
 * lack it (a failed retrieve would reach the app's error handling) and
 * records the store the retrieve then asks first. Clients are asked one at
 * a time, so stores after the one with the series are never contacted (or
 * asked for credentials); a client whose search or retrieve fails, or
 * whose retrieve finds nothing, is skipped.
 */
async function retrieveFromStoreWithSeries(
  clients: { [key: string]: DicomWebManager },
  studyInstanceUID: string,
  seriesInstanceUID: string,
): Promise<object[] | undefined> {
  for (const client of lookupClients(clients)) {
    let series: unknown[]
    try {
      series = await client.searchForSeries({
        studyInstanceUID,
        queryParams: { SeriesInstanceUID: seriesInstanceUID },
      })
    } catch (error) {
      logger.warn(
        `Failed to search for series "${seriesInstanceUID}" on a server`,
        error,
      )
      continue
    }
    if (series.length === 0) continue
    try {
      const metadata = await client.retrieveSeriesMetadata({
        studyInstanceUID,
        seriesInstanceUID,
      })
      if (metadata.length > 0) return metadata
    } catch (error) {
      /** Listed but not served here; another client may serve it */
      logger.warn(
        `Failed to retrieve metadata of series "${seriesInstanceUID}" on a server`,
        error,
      )
    }
  }
  return undefined
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
  try {
    const derivedSeriesMetadata = await retrieveFromStoreWithSeries(
      clients,
      studyInstanceUID,
      seriesInstanceUID,
    )
    if (
      derivedSeriesMetadata === undefined ||
      derivedSeriesMetadata.length === 0
    )
      return { kind: 'unresolved' }
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

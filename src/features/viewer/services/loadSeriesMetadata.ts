/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import type DicomWebManager from '../../../DicomWebManager'
import { logger } from '../../../utils/logger'
import { notifyVisualizationError, toError } from './derivedDataContext'

/**
 * Series in the order their instances are added to the viewer: by Series
 * Number, series without one last, then by Series Instance UID
 */
export function compareSeries(
  a: Pick<dmv.metadata.Series, 'SeriesNumber' | 'SeriesInstanceUID'>,
  b: Pick<dmv.metadata.Series, 'SeriesNumber' | 'SeriesInstanceUID'>,
): number {
  const numberOf = (series: typeof a): number => {
    const value = Number(series.SeriesNumber)
    return series.SeriesNumber == null || Number.isNaN(value)
      ? Number.POSITIVE_INFINITY
      : value
  }
  const byNumber = numberOf(a) - numberOf(b)
  if (byNumber !== 0 && !Number.isNaN(byNumber)) return byNumber
  if (a.SeriesInstanceUID === b.SeriesInstanceUID) return 0
  return a.SeriesInstanceUID < b.SeriesInstanceUID ? -1 : 1
}

/**
 * Search the study's series of one modality and pass each series' metadata
 * to `onMetadata`, in the order of `compareSeries` whatever order the
 * retrievals finish in: the viewer stacks overlays in the order they are
 * added, so the stacking is the same on every load. A series is passed on
 * as soon as every series before it has been, and a failed one does not
 * hold back the rest. Settles once every series was handled.
 */
export async function loadSeriesMetadata({
  client,
  studyInstanceUID,
  modality,
  label,
  onMetadata,
  isCurrent = () => true,
}: {
  client: DicomWebManager
  studyInstanceUID: string
  modality: string
  /** Name of the instances in log and error messages */
  label: string
  onMetadata: (metadata: dwc.api.Metadata[]) => void
  /** False once the viewer that asked is gone; its errors are not shown */
  isCurrent?: () => boolean
}): Promise<void> {
  const notify = (message: string): void => {
    if (isCurrent()) notifyVisualizationError(message)
  }
  return await new Promise<void>((resolve, reject) => {
    logger.log(`search for ${label} instances`)
    client
      .searchForSeries({
        studyInstanceUID,
        queryParams: { Modality: modality },
      })
      .then((matchedSeries): void => {
        const seriesList = matchedSeries ?? []
        if (seriesList.length === 0) {
          resolve()
          return
        }
        const ordered = seriesList
          .map(
            (rawSeries) =>
              dmv.metadata.formatMetadata(rawSeries)
                .dataset as dmv.metadata.Series,
          )
          .sort(compareSeries)
        /** Retrieved metadata, or null for a failed retrieval, by position */
        const settled = new Map<number, dwc.api.Metadata[] | null>()
        let next = 0
        /**
         * Pass on the settled series at the front of the order. Resolves
         * only after every series was passed on, so the URL-targeted
         * series is in the viewer before derived data is shown.
         */
        const release = (): void => {
          while (settled.has(next)) {
            const metadata = settled.get(next)
            settled.delete(next)
            next += 1
            if (metadata == null) continue
            /**
             * A failure while adding the retrieved metadata is not a
             * retrieval failure; report it as a display problem.
             */
            try {
              onMetadata(metadata)
            } catch (error: unknown) {
              logger.error(error)
              notify(`${label} could not be displayed.`)
            }
          }
          if (next === ordered.length) resolve()
        }
        ordered.forEach((series, index) => {
          client
            .retrieveSeriesMetadata({
              studyInstanceUID,
              seriesInstanceUID: series.SeriesInstanceUID,
            })
            .then((metadata): void => {
              settled.set(index, metadata)
              release()
            })
            .catch((error: unknown) => {
              logger.error(error)
              notify(`Retrieval of metadata of ${label} instances failed.`)
              settled.set(index, null)
              release()
            })
        })
      })
      .catch((error: unknown) => {
        logger.error(error)
        notify(`Search for ${label} instances failed.`)
        reject(toError(error))
      })
  })
}

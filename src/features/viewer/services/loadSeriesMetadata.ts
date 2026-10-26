/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import type DicomWebManager from '../../../DicomWebManager'
import { logger } from '../../../utils/logger'
import { notifyVisualizationError, toError } from './derivedDataContext'

/**
 * Search the study's series of one modality and pass each series' metadata
 * to `onMetadata`. Settles once every series was handled.
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
        /**
         * Resolve only after every series settled, so the URL-targeted
         * series is in the viewer before derived data is shown.
         */
        let pendingSeriesCount = seriesList.length
        const finishOne = (): void => {
          pendingSeriesCount -= 1
          if (pendingSeriesCount === 0) resolve()
        }
        for (const rawSeries of seriesList) {
          const { dataset } = dmv.metadata.formatMetadata(rawSeries)
          const series = dataset as dmv.metadata.Series
          client
            .retrieveSeriesMetadata({
              studyInstanceUID,
              seriesInstanceUID: series.SeriesInstanceUID,
            })
            .then((metadata): void => {
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
              finishOne()
            })
            .catch((error: unknown) => {
              logger.error(error)
              notify(`Retrieval of metadata of ${label} instances failed.`)
              finishOne()
            })
        }
      })
      .catch((error: unknown) => {
        logger.error(error)
        notify(`Search for ${label} instances failed.`)
        reject(toError(error))
      })
  })
}

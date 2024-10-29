import * as dmv from 'dicom-microscopy-viewer'

import DicomWebManager from '../DicomWebManager'
import { StorageClasses } from '../data/uids'
import { CustomError, errorTypes } from '../utils/CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from './NotificationMiddleware'
import { createSlides, Slide } from '../data/slides'

interface FetchImageMetadataParams {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  onSuccess: (slides: Slide[]) => void
  onError: (error: Error) => void
}

export const fetchImageMetadata = async ({
  clients,
  studyInstanceUID,
  onSuccess,
  onError
}: FetchImageMetadataParams): Promise<void> => {
  try {
    const images: dmv.metadata.VLWholeSlideMicroscopyImage[][] = []
    console.info(`search for series of study "${studyInstanceUID}"...`)

    const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    const matchedSeries = await client.searchForSeries({
      queryParams: {
        Modality: 'SM',
        StudyInstanceUID: studyInstanceUID
      }
    })

    await Promise.all(
      matchedSeries.map(async (s) => {
        const { dataset } = dmv.metadata.formatMetadata(s)
        const loadingSeries = dataset as dmv.metadata.Series
        console.info(
          `retrieve metadata of series "${loadingSeries.SeriesInstanceUID}"`
        )
        const retrievedMetadata = await client.retrieveSeriesMetadata({
          studyInstanceUID: studyInstanceUID,
          seriesInstanceUID: loadingSeries.SeriesInstanceUID
        })

        const seriesImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
        retrievedMetadata.forEach((item) => {
          if (
            item['00080016']?.Value?.[0] ===
            StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE
          ) {
            const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
              metadata: item
            })
            seriesImages.push(image)
          }
        })

        if (seriesImages.length > 0) {
          images.push(seriesImages)
        }
      })
    )
    const newSlides = createSlides(images)
    onSuccess(newSlides)
  } catch (err) {
    console.error(err)
    const customError = new CustomError(
      errorTypes.ENCODINGANDDECODING,
      'Image metadata could not be retrieved or decoded.'
    )
    onError(customError)
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      customError
    )
  }
}

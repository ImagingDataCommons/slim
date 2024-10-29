import { useState, useEffect, useRef } from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import DicomWebManager from '../DicomWebManager'
import { Slide, createSlides } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { CustomError, errorTypes } from '../utils/CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from '../services/NotificationMiddleware'

/**
 * Props for the useSlides hook - all props are optional since we'll cache them
 */
interface UseSlidesProps {
  /** Map of DICOM web clients keyed by storage class */
  clients?: { [key: string]: DicomWebManager }
  /** Study Instance UID to fetch slides for */
  studyInstanceUID?: string
}

/**
 * Return type for the useSlides hook
 */
interface UseSlidesReturn {
  /** Array of retrieved slides */
  slides: Slide[]
  /** Loading state indicator */
  isLoading: boolean
  /** Error object if retrieval failed */
  error: Error | null
}

// Cache for the last used values
let cachedClients: { [key: string]: DicomWebManager } | null = null
let cachedStudyUID: string | null = null
let cachedSlides: Slide[] = []

/**
 * Hook to fetch and manage whole slide microscopy images for a given study.
 * Values are cached so they can be reused if props are not provided.
 * 
 * @param props - Optional hook configuration props
 * @param props.clients - Map of DICOM web clients keyed by storage class
 * @param props.studyInstanceUID - Study Instance UID to fetch slides for
 */
export const useSlides = ({ 
  clients, 
  studyInstanceUID 
}: UseSlidesProps = {}): UseSlidesReturn => {
  const [slides, setSlides] = useState<Slide[]>(cachedSlides)
  const [isLoading, setIsLoading] = useState<boolean>(!cachedSlides.length)
  const [error, setError] = useState<Error | null>(null)
  const isMounted = useRef(true)

  // Use cached values if props are not provided
  const effectiveClients = clients || cachedClients
  const effectiveStudyUID = studyInstanceUID || cachedStudyUID

  // Cache new values when they're provided
  if (clients) cachedClients = clients
  if (studyInstanceUID) cachedStudyUID = studyInstanceUID

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    // Don't fetch if we don't have the required values
    if (!effectiveClients || !effectiveStudyUID) {
      return
    }

    const fetchImageMetadata = async (): Promise<void> => {
      try {
        const images: dmv.metadata.VLWholeSlideMicroscopyImage[][] = []
        console.info(`search for series of study "${effectiveStudyUID}"...`)
        
        const client = effectiveClients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
        const matchedSeries = await client.searchForSeries({
          queryParams: {
            Modality: 'SM',
            StudyInstanceUID: effectiveStudyUID
          }
        })

        await Promise.all(matchedSeries.map(async (s) => {
          const { dataset } = dmv.metadata.formatMetadata(s)
          const loadingSeries = dataset as dmv.metadata.Series
          console.info(
            `retrieve metadata of series "${loadingSeries.SeriesInstanceUID}"`
          )
          const retrievedMetadata = await client.retrieveSeriesMetadata({
            studyInstanceUID: effectiveStudyUID,
            seriesInstanceUID: loadingSeries.SeriesInstanceUID
          })

          const seriesImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
          retrievedMetadata.forEach((item) => {
            if (item['00080016']?.Value?.[0] === StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE) {
              const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
                metadata: item
              })
              seriesImages.push(image)
            }
          })

          if (seriesImages.length > 0) {
            images.push(seriesImages)
          }
        }))

        const newSlides = createSlides(images)
        if (isMounted.current) {
          cachedSlides = newSlides
          setSlides(newSlides)
          setIsLoading(false)
        }
      } catch (err) {
        console.error(err)
        const customError = new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Image metadata could not be retrieved or decoded.'
        )
        if (isMounted.current) {
          setError(customError)
          setIsLoading(false)
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.SLIM,
            customError
          )
        }
      }
    }

    void fetchImageMetadata()
  }, [effectiveClients, effectiveStudyUID])

  return { slides, isLoading, error }
} 
import { useState, useEffect } from 'react'

import DicomWebManager from '../DicomWebManager'
import { Slide } from '../data/slides'
import { fetchImageMetadata } from '../services/fetchImageMetadata'

interface UseSlidesProps {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
}

interface UseSlidesReturn {
  slides: Slide[]
  isLoading: boolean
  error: Error | null
}

const slidesCache = new Map<string, Slide[]>()
const pendingRequests = new Map<string, Promise<Slide[]>>()

/**
 * Hook to fetch and manage whole slide microscopy images for a given study.
 * Values are cached so they can be reused if props are not provided.
 *
 * @param props - Hook configuration props
 * @param props.clients - Map of DICOM web clients keyed by storage class
 */
export const useSlides = ({ clients, studyInstanceUID }: UseSlidesProps): UseSlidesReturn => {
  const [slides, setSlides] = useState<Slide[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (studyInstanceUID === undefined) {
      setSlides([])
      setIsLoading(false)
      return
    }

    const cachedData = slidesCache.get(studyInstanceUID)
    if (cachedData !== undefined) {
      setSlides(cachedData)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const fetchSlides = async (): Promise<void> => {
      // Check if there's already a pending request for this study
      let pendingRequest = pendingRequests.get(studyInstanceUID)

      if (pendingRequest === undefined) {
        // Create a new promise for this request
        pendingRequest = new Promise((resolve, reject): void => {
          fetchImageMetadata({
            clients,
            studyInstanceUID,
            onSuccess: (newSlides) => {
              slidesCache.set(studyInstanceUID, newSlides)
              resolve(newSlides)
            },
            onError: (err) => {
              reject(err)
            }
          }).catch((err) => {
            reject(err)
          })
        })
        pendingRequests.set(studyInstanceUID, pendingRequest)
      }

      try {
        const newSlides = await pendingRequest
        setSlides(newSlides)
        setError(null)
      } catch (err) {
        setError(err as Error)
        setSlides([])
      } finally {
        pendingRequests.delete(studyInstanceUID)
        setIsLoading(false)
      }
    }

    void fetchSlides()
  }, [clients, studyInstanceUID])

  return { slides, isLoading, error }
}

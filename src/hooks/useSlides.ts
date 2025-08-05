import { useState, useEffect, useMemo } from 'react'

import DicomWebManager from '../DicomWebManager'
import { Slide } from '../data/slides'
import { fetchImageMetadata } from '../services/fetchImageMetadata'

interface UseSlidesProps {
  clients?: { [key: string]: DicomWebManager }
  studyInstanceUID?: string
}

interface UseSlidesReturn {
  slides: Slide[]
  isLoading: boolean
  error: Error | null
}

const slidesCache = new Map<string, Slide[]>()
const pendingRequests = new Map<string, Promise<Slide[]>>()
const cacheTimestamps = new Map<string, number>()

// Cache expiration time: 30 minutes
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000

// Clean up expired cache entries
const cleanupExpiredCache = (): void => {
  const now = Date.now()
  for (const [key, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > CACHE_EXPIRATION_TIME) {
      slidesCache.delete(key)
      cacheTimestamps.delete(key)
    }
  }
}

// Utility functions for cache management
export const clearSlidesCache = (studyInstanceUID?: string): void => {
  if (studyInstanceUID !== null && studyInstanceUID !== undefined && studyInstanceUID !== '' && studyInstanceUID.length > 0) {
    slidesCache.delete(studyInstanceUID)
    cacheTimestamps.delete(studyInstanceUID)
    pendingRequests.delete(studyInstanceUID)
  } else {
    slidesCache.clear()
    cacheTimestamps.clear()
    pendingRequests.clear()
  }
}

export const getCachedSlides = (studyInstanceUID: string): Slide[] | undefined => {
  return slidesCache.get(studyInstanceUID)
}

export const isSlidesCached = (studyInstanceUID: string): boolean => {
  return slidesCache.has(studyInstanceUID)
}

/**
 * Hook to fetch and manage whole slide microscopy images for a given study.
 * Values are cached so they can be reused if props are not provided.
 * If no arguments are provided, returns the most recently cached slides.
 *
 * @param props - Hook configuration props (optional)
 * @param props.clients - Map of DICOM web clients keyed by storage class
 * @param props.studyInstanceUID - Study instance UID to fetch slides for
 */
export const useSlides = ({ clients, studyInstanceUID }: UseSlidesProps = {}): UseSlidesReturn => {
  const [slides, setSlides] = useState<Slide[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Clean up expired cache entries periodically
    cleanupExpiredCache()

    // If no arguments provided, return cached slides if available
    if ((clients === null || clients === undefined) || (studyInstanceUID === null || studyInstanceUID === undefined) || studyInstanceUID === '' || studyInstanceUID.length === 0) {
      // Get the most recently cached slides (last entry in the cache)
      const cachedEntries = Array.from(slidesCache.entries())
      if (cachedEntries.length > 0) {
        const lastCachedSlides = cachedEntries[cachedEntries.length - 1][1]
        setSlides(lastCachedSlides)
        setIsLoading(false)
        setError(null)
      } else {
        setSlides([])
        setIsLoading(false)
        setError(null)
      }
      return
    }

    const cachedData = slidesCache.get(studyInstanceUID)
    if (cachedData !== undefined) {
      setSlides(cachedData)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    const fetchSlides = async (): Promise<void> => {
      // Check if there's already a pending request for this study
      let pendingRequest = pendingRequests.get(studyInstanceUID)

      if (pendingRequest === undefined) {
        // Create a new promise for this request
        pendingRequest = new Promise<Slide[]>((resolve, reject): void => {
          fetchImageMetadata({
            clients,
            studyInstanceUID,
            onSuccess: (newSlides) => {
              slidesCache.set(studyInstanceUID, newSlides)
              cacheTimestamps.set(studyInstanceUID, Date.now())
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

  // Memoize the return value to prevent unnecessary re-renders
  const result = useMemo(() => ({
    slides,
    isLoading,
    error
  }), [slides, isLoading, error])

  return result
}

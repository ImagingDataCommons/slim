import { useCallback, useEffect, useMemo, useState } from 'react'

import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { fetchImageMetadata } from '../services/fetchImageMetadata'

interface UseSlidesProps {
  clients?: { [key: string]: DicomWebManager }
  studyInstanceUID?: string
}

interface UseSlidesReturn {
  slides: Slide[]
  isLoading: boolean
  error: Error | null
  /** Drop any cached result for the study and fetch it again */
  retry: () => void
}

interface CachedSlides {
  /** Server the slides were fetched from; the same study UID may exist on several */
  serverUrl: string
  slides: Slide[]
}

const slidesCache = new Map<string, CachedSlides>()
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

const getServerUrl = (clients: { [key: string]: DicomWebManager }): string =>
  clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]?.baseURL ?? ''

// Utility functions for cache management
export const clearSlidesCache = (studyInstanceUID?: string): void => {
  if (
    studyInstanceUID !== null &&
    studyInstanceUID !== undefined &&
    studyInstanceUID !== '' &&
    studyInstanceUID.length > 0
  ) {
    slidesCache.delete(studyInstanceUID)
    cacheTimestamps.delete(studyInstanceUID)
    for (const key of pendingRequests.keys()) {
      if (key.endsWith(`|${studyInstanceUID}`)) {
        pendingRequests.delete(key)
      }
    }
  } else {
    slidesCache.clear()
    cacheTimestamps.clear()
    pendingRequests.clear()
  }
}

export const getCachedSlides = (
  studyInstanceUID: string,
): Slide[] | undefined => {
  return slidesCache.get(studyInstanceUID)?.slides
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
export const useSlides = ({
  clients,
  studyInstanceUID,
}: UseSlidesProps = {}): UseSlidesReturn => {
  const [slides, setSlides] = useState<Slide[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback((): void => {
    if (studyInstanceUID !== undefined && studyInstanceUID !== '') {
      clearSlidesCache(studyInstanceUID)
    }
    setAttempt((value) => value + 1)
  }, [studyInstanceUID])

  useEffect(() => {
    // Clean up expired cache entries periodically
    cleanupExpiredCache()

    // If no arguments provided, return cached slides if available
    if (
      clients === null ||
      clients === undefined ||
      studyInstanceUID === null ||
      studyInstanceUID === undefined ||
      studyInstanceUID === '' ||
      studyInstanceUID.length === 0
    ) {
      // Get the most recently cached slides (last entry in the cache)
      const cachedEntries = Array.from(slidesCache.entries())
      if (cachedEntries.length > 0) {
        const lastCachedSlides = cachedEntries[cachedEntries.length - 1][1]
        setSlides(lastCachedSlides.slides)
        setIsLoading(false)
        setError(null)
      } else {
        setSlides([])
        setIsLoading(false)
        setError(null)
      }
      return
    }

    const serverUrl = getServerUrl(clients)
    const cachedData = slidesCache.get(studyInstanceUID)
    if (cachedData !== undefined && cachedData.serverUrl === serverUrl) {
      setSlides(cachedData.slides)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    /** A retry gets its own request instead of joining one still in flight */
    const requestKey = `${serverUrl}|${attempt}|${studyInstanceUID}`
    const fetchSlides = async (): Promise<void> => {
      // Check if there's already a pending request for this study
      let pendingRequest = pendingRequests.get(requestKey)

      if (pendingRequest === undefined) {
        // Create a new promise for this request
        pendingRequest = new Promise<Slide[]>((resolve, reject): void => {
          fetchImageMetadata({
            clients,
            studyInstanceUID,
            onSuccess: (newSlides) => {
              /** Not cached when empty, so data added to the store later shows up */
              if (newSlides.length > 0) {
                slidesCache.set(studyInstanceUID, {
                  serverUrl,
                  slides: newSlides,
                })
                cacheTimestamps.set(studyInstanceUID, Date.now())
              }
              resolve(newSlides)
            },
            onError: (err) => {
              reject(err)
            },
          }).catch((err) => {
            reject(err)
          })
        })
        pendingRequests.set(requestKey, pendingRequest)
      }

      try {
        const newSlides = await pendingRequest
        setSlides(newSlides)
        setError(null)
      } catch (err) {
        setError(err as Error)
        setSlides([])
      } finally {
        pendingRequests.delete(requestKey)
        setIsLoading(false)
      }
    }

    void fetchSlides()
  }, [clients, studyInstanceUID, attempt])

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      slides,
      isLoading,
      error,
      retry,
    }),
    [slides, isLoading, error, retry],
  )
}

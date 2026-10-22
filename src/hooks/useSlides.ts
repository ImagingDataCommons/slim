import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

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

/**
 * Retry count per study, shared by every useSlides instance (CaseViewer, the
 * validation provider, …) so a retry in one refreshes all of them.
 */
const retryGenerations = new Map<string, number>()
const retryListeners = new Set<() => void>()

const subscribeToRetries = (listener: () => void): (() => void) => {
  retryListeners.add(listener)
  return () => {
    retryListeners.delete(listener)
  }
}

const requestRetry = (studyInstanceUID: string): void => {
  retryGenerations.set(
    studyInstanceUID,
    (retryGenerations.get(studyInstanceUID) ?? 0) + 1,
  )
  for (const listener of retryListeners) listener()
}

const CACHE_EXPIRATION_TIME = 30 * 60 * 1000
/** Studies whose slide metadata stays cached; the least recent is dropped */
export const MAX_CACHED_STUDIES = 10

/** Cache `slides` as the most recent entry, evicting the least recent */
const cacheSlides = (studyInstanceUID: string, entry: CachedSlides): void => {
  slidesCache.delete(studyInstanceUID)
  slidesCache.set(studyInstanceUID, entry)
  cacheTimestamps.set(studyInstanceUID, Date.now())
  while (slidesCache.size > MAX_CACHED_STUDIES) {
    const oldest = slidesCache.keys().next().value
    if (oldest === undefined) break
    slidesCache.delete(oldest)
    cacheTimestamps.delete(oldest)
  }
}

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

/**
 * Study and server a result belongs to. Empty only without a study, where
 * the most recently cached slides stand in; a study without clients gets
 * its own key and no slides
 */
const resultKey = (
  clients: { [key: string]: DicomWebManager } | undefined,
  studyInstanceUID: string | undefined,
): string =>
  studyInstanceUID == null || studyInstanceUID === ''
    ? ''
    : `${clients == null ? '' : getServerUrl(clients)}|${studyInstanceUID}`

/** Slides cached for the study on this server, if any */
const cachedSlidesFor = (
  clients: { [key: string]: DicomWebManager } | undefined,
  studyInstanceUID: string | undefined,
): Slide[] | undefined => {
  if (clients == null || studyInstanceUID == null || studyInstanceUID === '') {
    return undefined
  }
  const cached = slidesCache.get(studyInstanceUID)
  return cached !== undefined && cached.serverUrl === getServerUrl(clients)
    ? cached.slides
    : undefined
}

/** Stable empty list while the current study's slides are not loaded */
const NO_SLIDES: Slide[] = []

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
  /** Study and server the slides and error above were loaded for */
  const [loadedKey, setLoadedKey] = useState<string | undefined>(undefined)
  const attempt = useSyncExternalStore(
    subscribeToRetries,
    () => retryGenerations.get(studyInstanceUID ?? '') ?? 0,
  )

  const retry = useCallback((): void => {
    if (studyInstanceUID !== undefined && studyInstanceUID !== '') {
      clearSlidesCache(studyInstanceUID)
    }
    requestRetry(studyInstanceUID ?? '')
  }, [studyInstanceUID])

  useEffect(() => {
    cleanupExpiredCache()

    const key = resultKey(clients, studyInstanceUID)
    /** A study without clients has nothing to load from */
    if (
      (clients === null || clients === undefined) &&
      studyInstanceUID !== undefined &&
      studyInstanceUID !== ''
    ) {
      setSlides([])
      setIsLoading(false)
      setError(null)
      setLoadedKey(key)
      return
    }
    /** Without a study, fall back to the most recently cached slides */
    if (
      clients === null ||
      clients === undefined ||
      studyInstanceUID === null ||
      studyInstanceUID === undefined ||
      studyInstanceUID === '' ||
      studyInstanceUID.length === 0
    ) {
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
      setLoadedKey('')
      return
    }

    const serverUrl = getServerUrl(clients)
    const cachedData = slidesCache.get(studyInstanceUID)
    if (cachedData !== undefined && cachedData.serverUrl === serverUrl) {
      setSlides(cachedData.slides)
      setIsLoading(false)
      setError(null)
      setLoadedKey(key)
      return
    }

    setIsLoading(true)
    setError(null)

    /** A slower fetch for the previous study must not replace this one */
    let isCurrent = true

    /** A retry gets its own request instead of joining one still in flight */
    const requestKey = `${serverUrl}|${attempt}|${studyInstanceUID}`
    const fetchSlides = async (): Promise<void> => {
      let pendingRequest = pendingRequests.get(requestKey)

      if (pendingRequest === undefined) {
        pendingRequest = new Promise<Slide[]>((resolve, reject): void => {
          fetchImageMetadata({
            clients,
            studyInstanceUID,
            onSuccess: (newSlides) => {
              /** Not cached when empty, so data added to the store later shows up */
              if (newSlides.length > 0) {
                cacheSlides(studyInstanceUID, {
                  serverUrl,
                  slides: newSlides,
                })
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

      await pendingRequest
        .then((newSlides) => {
          if (!isCurrent) return
          setSlides(newSlides)
          setError(null)
          setLoadedKey(key)
        })
        .catch((err: unknown) => {
          if (!isCurrent) return
          setError(err instanceof Error ? err : new Error(String(err)))
          setSlides([])
          setLoadedKey(key)
        })
        .finally(() => {
          pendingRequests.delete(requestKey)
          if (isCurrent) setIsLoading(false)
        })
    }

    void fetchSlides()
    return () => {
      isCurrent = false
    }
  }, [clients, studyInstanceUID, attempt])

  /**
   * Until the effect has run for a new study or server, the state above
   * still holds the previous one's result; it is never returned as this one's
   */
  const isCurrentResult = loadedKey === resultKey(clients, studyInstanceUID)
  /** A cached study is returned at once, without a loading render */
  const cachedSlides = isCurrentResult
    ? undefined
    : cachedSlidesFor(clients, studyInstanceUID)
  return useMemo(() => {
    if (isCurrentResult) return { slides, isLoading, error, retry }
    if (cachedSlides !== undefined) {
      return { slides: cachedSlides, isLoading: false, error: null, retry }
    }
    return { slides: NO_SLIDES, isLoading: true, error: null, retry }
  }, [isCurrentResult, cachedSlides, slides, isLoading, error, retry])
}

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

/**
 * Most recently cached entry, the stand-in for callers without a study, and
 * the listeners told when it changes
 */
let latestEntry: CachedSlides | undefined
const latestEntryListeners = new Set<() => void>()

const subscribeToLatestEntry = (listener: () => void): (() => void) => {
  latestEntryListeners.add(listener)
  return () => {
    latestEntryListeners.delete(listener)
  }
}

/** Call after any cache change */
const updateLatestEntry = (): void => {
  const latest = [...slidesCache.values()].at(-1)
  if (latest === latestEntry) return
  latestEntry = latest
  for (const listener of latestEntryListeners) listener()
}

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
  updateLatestEntry()
}

const isExpired = (studyInstanceUID: string): boolean =>
  Date.now() - (cacheTimestamps.get(studyInstanceUID) ?? 0) >
  CACHE_EXPIRATION_TIME

const cleanupExpiredCache = (): void => {
  for (const key of [...cacheTimestamps.keys()]) {
    if (isExpired(key)) {
      slidesCache.delete(key)
      cacheTimestamps.delete(key)
    }
  }
  updateLatestEntry()
}

const getServerUrl = (clients: { [key: string]: DicomWebManager }): string =>
  clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]?.baseURL ?? ''

/** Slides cached, and not expired, for the study on this server */
const readCachedSlides = (
  clients: { [key: string]: DicomWebManager },
  studyInstanceUID: string,
): Slide[] | undefined => {
  const cached = slidesCache.get(studyInstanceUID)
  return cached !== undefined &&
    cached.serverUrl === getServerUrl(clients) &&
    !isExpired(studyInstanceUID)
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
  updateLatestEntry()
}

export const getCachedSlides = (
  studyInstanceUID: string,
): Slide[] | undefined => {
  return slidesCache.get(studyInstanceUID)?.slides
}

export const isSlidesCached = (studyInstanceUID: string): boolean => {
  return slidesCache.has(studyInstanceUID)
}

/** Slides (or the error) delivered for a study and server */
interface DeliveredSlides {
  key: string
  slides: Slide[]
  error: Error | null
}

/**
 * Hook to fetch and manage whole slide microscopy images for a given study.
 * Values are cached so they can be reused if props are not provided.
 * If no arguments are provided, returns the most recently cached slides.
 *
 * Each instance keeps the slides it delivered for its study and server, so
 * cache housekeeping by other instances (expiry, eviction, a refetch) never
 * changes what a mounted view shows. The cache only spares a fetch, and
 * answers the first render for a study before the effect has run. A result
 * for another study or server is never returned.
 *
 * @param props - Hook configuration props (optional)
 * @param props.clients - Map of DICOM web clients keyed by storage class
 * @param props.studyInstanceUID - Study instance UID to fetch slides for
 */
export const useSlides = ({
  clients,
  studyInstanceUID,
}: UseSlidesProps = {}): UseSlidesReturn => {
  const [delivered, setDelivered] = useState<DeliveredSlides | undefined>(
    undefined,
  )
  /** Study and server a fetch is running for */
  const [pendingKey, setPendingKey] = useState<string | undefined>(undefined)
  /**
   * Study and server this instance serves. When they change, what it
   * delivered before is dropped: coming back to them later must not show
   * that old result, which the cache or a new fetch answers instead
   */
  const key =
    clients == null || studyInstanceUID === undefined || studyInstanceUID === ''
      ? ''
      : `${getServerUrl(clients)}|${studyInstanceUID}`
  const [servedKey, setServedKey] = useState(key)
  if (servedKey !== key) {
    setServedKey(key)
    setDelivered(undefined)
    setPendingKey(undefined)
  }
  const latest = useSyncExternalStore(subscribeToLatestEntry, () => latestEntry)
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
    setPendingKey(undefined)
    /** Without a study, or without clients, there is nothing to fetch */
    if (
      studyInstanceUID === undefined ||
      studyInstanceUID === '' ||
      clients === null ||
      clients === undefined
    ) {
      return
    }

    const serverUrl = getServerUrl(clients)
    const key = `${serverUrl}|${studyInstanceUID}`
    const cachedSlides = readCachedSlides(clients, studyInstanceUID)
    if (cachedSlides !== undefined) {
      /** Usually what the first render already answered; keep that object */
      setDelivered((current) =>
        current?.key === key &&
        current.slides === cachedSlides &&
        current.error === null
          ? current
          : { key, slides: cachedSlides, error: null },
      )
      return
    }
    setPendingKey(key)

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
              /**
               * Not cached when empty, so data added to the store later shows
               * up, nor when a retry has started since: its newer answer wins
               */
              const isLatestAttempt =
                (retryGenerations.get(studyInstanceUID) ?? 0) === attempt
              if (newSlides.length > 0 && isLatestAttempt) {
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
          if (isCurrent) setDelivered({ key, slides: newSlides, error: null })
        })
        .catch((err: unknown) => {
          if (!isCurrent) return
          setDelivered({
            key,
            slides: [],
            error: err instanceof Error ? err : new Error(String(err)),
          })
        })
        .finally(() => {
          pendingRequests.delete(requestKey)
          if (isCurrent) setPendingKey(undefined)
        })
    }

    void fetchSlides()
    return () => {
      isCurrent = false
    }
  }, [clients, studyInstanceUID, attempt])

  return useMemo(() => {
    /** Without a study, the most recently cached slides stand in */
    if (studyInstanceUID === undefined || studyInstanceUID === '') {
      return {
        slides: latest?.slides ?? NO_SLIDES,
        isLoading: false,
        error: null,
        retry,
      }
    }
    /** A study without clients has nothing to load from */
    if (clients === null || clients === undefined) {
      return { slides: NO_SLIDES, isLoading: false, error: null, retry }
    }
    if (delivered?.key === key) {
      const isRefetching = pendingKey === key
      return {
        slides: delivered.slides,
        isLoading: isRefetching,
        error: isRefetching ? null : delivered.error,
        retry,
      }
    }
    /**
     * First render for this study and server, before the effect: a cached
     * study is answered at once, anything else is loading
     */
    const cachedSlides = readCachedSlides(clients, studyInstanceUID)
    return cachedSlides !== undefined
      ? { slides: cachedSlides, isLoading: false, error: null, retry }
      : { slides: NO_SLIDES, isLoading: true, error: null, retry }
  }, [clients, studyInstanceUID, key, latest, delivered, pendingKey, retry])
}

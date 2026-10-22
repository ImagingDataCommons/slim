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
 * Notified on every cache change; each useSlides instance reads its study's
 * entry with useSyncExternalStore, so it renders from the cache as it is now
 */
const cacheListeners = new Set<() => void>()

const subscribeToCache = (listener: () => void): (() => void) => {
  cacheListeners.add(listener)
  return () => {
    cacheListeners.delete(listener)
  }
}

const notifyCacheChange = (): void => {
  for (const listener of cacheListeners) listener()
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
  notifyCacheChange()
}

const isExpired = (studyInstanceUID: string): boolean =>
  Date.now() - (cacheTimestamps.get(studyInstanceUID) ?? 0) >
  CACHE_EXPIRATION_TIME

const cleanupExpiredCache = (): void => {
  let isChanged = false
  for (const key of [...cacheTimestamps.keys()]) {
    if (isExpired(key)) {
      slidesCache.delete(key)
      cacheTimestamps.delete(key)
      isChanged = true
    }
  }
  if (isChanged) notifyCacheChange()
}

const getServerUrl = (clients: { [key: string]: DicomWebManager }): string =>
  clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]?.baseURL ?? ''

/**
 * Cache entry a useSlides instance reads: its study's, or without a study
 * the most recent one. The same object until the cache changes.
 */
const cacheSnapshot =
  (studyInstanceUID: string | undefined) =>
  ():
    | {
        studyInstanceUID: string
        entry: CachedSlides
      }
    | undefined => {
    const studyKey =
      studyInstanceUID === undefined || studyInstanceUID === ''
        ? [...slidesCache.keys()].at(-1)
        : studyInstanceUID
    if (studyKey === undefined) return undefined
    const entry = slidesCache.get(studyKey)
    return entry === undefined ? undefined : snapshotOf(studyKey, entry)
  }

/** Stable snapshot objects, so useSyncExternalStore sees no change */
const snapshots = new WeakMap<
  CachedSlides,
  { studyInstanceUID: string; entry: CachedSlides }
>()
const snapshotOf = (
  studyInstanceUID: string,
  entry: CachedSlides,
): { studyInstanceUID: string; entry: CachedSlides } => {
  let snapshot = snapshots.get(entry)
  if (snapshot === undefined) {
    snapshot = { studyInstanceUID, entry }
    snapshots.set(entry, snapshot)
  }
  return snapshot
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
  notifyCacheChange()
}

export const getCachedSlides = (
  studyInstanceUID: string,
): Slide[] | undefined => {
  return slidesCache.get(studyInstanceUID)?.slides
}

export const isSlidesCached = (studyInstanceUID: string): boolean => {
  return slidesCache.has(studyInstanceUID)
}

/** A fetch that settled, and the study and server it was for */
interface FetchResult {
  key: string
  slides: Slide[]
  error: Error | null
}

/**
 * Hook to fetch and manage whole slide microscopy images for a given study.
 * Values are cached so they can be reused if props are not provided.
 * If no arguments are provided, returns the most recently cached slides.
 *
 * Every render answers for the current study and server only: from the
 * cache when it holds them, else from a fetch for them, else as loading.
 * A result for another study or server is never returned.
 *
 * @param props - Hook configuration props (optional)
 * @param props.clients - Map of DICOM web clients keyed by storage class
 * @param props.studyInstanceUID - Study instance UID to fetch slides for
 */
export const useSlides = ({
  clients,
  studyInstanceUID,
}: UseSlidesProps = {}): UseSlidesReturn => {
  const [result, setResult] = useState<FetchResult | undefined>(undefined)
  /** Study and server a fetch is running for */
  const [pendingKey, setPendingKey] = useState<string | undefined>(undefined)
  const cached = useSyncExternalStore(
    subscribeToCache,
    cacheSnapshot(studyInstanceUID),
  )
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
    if (
      clients === null ||
      clients === undefined ||
      studyInstanceUID === undefined ||
      studyInstanceUID === '' ||
      (slidesCache.get(studyInstanceUID)?.serverUrl === getServerUrl(clients) &&
        !isExpired(studyInstanceUID))
    ) {
      return
    }

    const serverUrl = getServerUrl(clients)
    const key = `${serverUrl}|${studyInstanceUID}`
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
          if (isCurrent) setResult({ key, slides: newSlides, error: null })
        })
        .catch((err: unknown) => {
          if (!isCurrent) return
          setResult({
            key,
            slides: [],
            error: err instanceof Error ? err : new Error(String(err)),
          })
        })
        .finally(() => {
          pendingRequests.delete(requestKey)
          if (isCurrent) {
            setPendingKey((current) => (current === key ? undefined : current))
          }
        })
    }

    void fetchSlides()
    return () => {
      isCurrent = false
    }
  }, [clients, studyInstanceUID, attempt])

  return useMemo(() => {
    const isFresh = cached !== undefined && !isExpired(cached.studyInstanceUID)
    /** Without a study, the most recently cached slides stand in */
    if (studyInstanceUID === undefined || studyInstanceUID === '') {
      return {
        slides: isFresh ? cached.entry.slides : NO_SLIDES,
        isLoading: false,
        error: null,
        retry,
      }
    }
    /** A study without clients has nothing to load from */
    if (clients === null || clients === undefined) {
      return { slides: NO_SLIDES, isLoading: false, error: null, retry }
    }
    if (isFresh && cached.entry.serverUrl === getServerUrl(clients)) {
      return {
        slides: cached.entry.slides,
        isLoading: false,
        error: null,
        retry,
      }
    }
    const key = `${getServerUrl(clients)}|${studyInstanceUID}`
    if (result?.key === key && pendingKey !== key) {
      return {
        slides: result.slides,
        isLoading: false,
        error: result.error,
        retry,
      }
    }
    return { slides: NO_SLIDES, isLoading: true, error: null, retry }
  }, [cached, clients, studyInstanceUID, result, pendingKey, retry])
}

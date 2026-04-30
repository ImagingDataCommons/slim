// skipcq: JS-C1003

// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import * as dwc from 'dicomweb-client'

import type { DicomWebManagerErrorHandler, ServerSettings } from './AppConfig'
import DicomMetadataStore, {
  type Instance,
} from './services/DICOMMetadataStore'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from './services/NotificationMiddleware'
import { CustomError, errorTypes } from './utils/CustomError'
import { joinUrl } from './utils/url'
import getXHRRetryHook from './utils/xhrRetryHook'

const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary

interface Store {
  id: string
  read: boolean
  write: boolean
  client: dwc.api.DICOMwebClient
  settings: ServerSettings
}

/** DICOM JSON tag keys used for cross-store deduplication of search results. */
const STUDY_INSTANCE_UID_TAG = '0020000D'
const SERIES_INSTANCE_UID_TAG = '0020000E'
const SOP_INSTANCE_UID_TAG = '00080018'

type DicomJsonObject = Record<string, { Value?: unknown[] } | undefined>

const getDicomTagValue = (
  obj: DicomJsonObject,
  tag: string,
): string | undefined => {
  const value = obj[tag]?.Value?.[0]
  return typeof value === 'string' ? value : undefined
}

/**
 * Build a stable dedup key for a DICOM JSON search result. Falls back to a
 * JSON-stringified representation when no UID is present so we never silently
 * drop entries (e.g. malformed responses) but still merge actual duplicates.
 */
const buildDedupKey = (
  obj: DicomJsonObject,
  tags: readonly string[],
): string => {
  const parts: string[] = []
  for (const tag of tags) {
    const v = getDicomTagValue(obj, tag)
    if (v === undefined) {
      return JSON.stringify(obj)
    }
    parts.push(v)
  }
  return parts.join('|')
}

/**
 * Run the same DICOMweb operation against every readable store in parallel,
 * merge the results, and de-duplicate them by the supplied DICOM tag keys.
 *
 * Used to support reading derived data (SR/SEG/ANN/PM/PR) from BOTH the
 * primary configured server and any secondary store specified via the URL
 * `gcp` query parameter (see GH-320).
 *
 * Stores are queried independently. Per-store failures are logged but do not
 * abort the merge: a missing/forbidden store on one side should not hide
 * results that are available on the other.
 */
const searchAcrossStores = async <T extends DicomJsonObject>(
  stores: Store[],
  dedupTags: readonly string[],
  call: (store: Store) => Promise<T[]>,
): Promise<T[]> => {
  const readable = stores.filter((s) => s.read)
  if (readable.length === 0) {
    return []
  }
  const results = await Promise.all(
    readable.map(async (store) => {
      try {
        return await call(store)
      } catch (error: unknown) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `search against store "${store.id}" failed; ` +
              'continuing with the remaining stores',
            error,
          )
        }
        return [] as T[]
      }
    }),
  )

  const merged: T[] = []
  const seen = new Set<string>()
  for (const items of results) {
    for (const item of items) {
      const key = buildDedupKey(item, dedupTags)
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(item)
      }
    }
  }
  return merged
}

/**
 * Try the same DICOMweb retrieve operation against each readable store in
 * order, returning on the first success and falling through on failures
 * (typically 404 when an instance only exists in a different store).
 *
 * Throws the last encountered error if every store fails so legitimate
 * errors are still surfaced.
 */
const retrieveWithFallback = async <T>(
  stores: Store[],
  call: (store: Store) => Promise<T>,
): Promise<T> => {
  const readable = stores.filter((s) => s.read)
  if (readable.length === 0) {
    throw new CustomError(
      errorTypes.COMMUNICATION,
      'No readable DICOMweb store is configured.',
    )
  }
  let lastError: unknown
  for (const store of readable) {
    try {
      return await call(store)
    } catch (error: unknown) {
      lastError = error
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `retrieve against store "${store.id}" failed; ` +
            'falling back to the next configured store',
          error,
        )
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError as unknown))
}

export default class DicomWebManager implements dwc.api.DICOMwebClient {
  private readonly stores: Store[] = []

  private readonly handleError: DicomWebManagerErrorHandler

  constructor({
    baseUri,
    settings,
    onError,
  }: {
    baseUri: string
    settings: ServerSettings[]
    onError?: DicomWebManagerErrorHandler
  }) {
    if (onError != null) {
      this.handleError = onError
    } else {
      this.handleError = (error, serverSettings) => {
        if (process.env.NODE_ENV === 'development') {
          console.error(error, serverSettings)
        }
      }
    }

    if (settings.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.COMMUNICATION,
          'At least one server needs to be configured.',
        ),
      )
    }

    settings.forEach((serverSettings) => {
      if (serverSettings === undefined) {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.COMMUNICATION,
            'At least one server needs to be configured.',
          ),
        )
      }

      let serviceUrl: string
      if (serverSettings.url !== undefined) {
        serviceUrl = serverSettings.url
      } else if (serverSettings.path !== undefined) {
        serviceUrl = joinUrl(serverSettings.path, baseUri)
      } else {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.COMMUNICATION,
            'Either path or full URL needs to be configured for server.',
          ),
        )
        throw new CustomError(
          errorTypes.COMMUNICATION,
          'Either path or full URL needs to be configured for server.',
        )
      }

      const hasHttpsUrl = (url?: string): boolean =>
        url?.startsWith('https') ?? false

      const clientSettings: dwc.api.DICOMwebClientOptions = {
        url: serviceUrl,
      }

      const shouldUpgradeInsecure =
        serverSettings.upgradeInsecureRequests === true &&
        [
          serviceUrl,
          serverSettings.qidoPathPrefix,
          serverSettings.wadoPathPrefix,
          serverSettings.stowPathPrefix,
        ].some(hasHttpsUrl)

      if (serverSettings.qidoPathPrefix !== undefined) {
        clientSettings.qidoURLPrefix = serverSettings.qidoPathPrefix
      }
      if (serverSettings.wadoPathPrefix !== undefined) {
        clientSettings.wadoURLPrefix = serverSettings.wadoPathPrefix
      }
      if (serverSettings.stowPathPrefix !== undefined) {
        clientSettings.stowURLPrefix = serverSettings.stowPathPrefix
      }

      if (shouldUpgradeInsecure) {
        clientSettings.headers = {
          ...clientSettings.headers,
          'Content-Security-Policy': 'upgrade-insecure-requests',
        }
      }

      if (serverSettings.retry !== undefined) {
        clientSettings.requestHooks = [getXHRRetryHook(serverSettings.retry)]
      }

      clientSettings.errorInterceptor = (
        error: dwc.api.DICOMwebClientError,
      ) => {
        this.handleError(error, serverSettings)
      }

      this.stores.push({
        id: serverSettings.id,
        write: serverSettings.write ?? false,
        read: serverSettings.read ?? true,
        client: new dwc.api.DICOMwebClient(clientSettings),
        settings: serverSettings,
      })
    })
  }

  get baseURL(): string {
    return this.stores[0].client.baseURL
  }

  /**
   * Update auth (or other) headers on every wrapped store so token refreshes
   * propagate to the primary AND secondary endpoints.
   */
  updateHeaders = (fields: { [name: string]: string }): void => {
    for (const f in fields) {
      for (const store of this.stores) {
        store.client.headers[f] = fields[f]
      }
    }
  }

  get headers(): { [name: string]: string } {
    return this.stores[0].client.headers
  }

  /**
   * Store new instances in the first writable configured store. Picking the
   * first writable (rather than always store[0]) keeps backwards compatibility
   * with single-store deployments while letting STOW route to the secondary
   * (`gcp=` URL) annotation store when present.
   */
  storeInstances = async (
    options: dwc.api.StoreInstancesOptions,
  ): Promise<void> => {
    const writable = this.stores.find((s) => s.write)
    if (writable === undefined) {
      return await Promise.reject(new Error('Store is not writable.'))
    }
    return await writable.client.storeInstances(options)
  }

  searchForStudies = async (
    options: dwc.api.SearchForStudiesOptions,
  ): Promise<dwc.api.Study[]> => {
    const merged = await searchAcrossStores(
      this.stores,
      [STUDY_INSTANCE_UID_TAG],
      async (store) =>
        (await store.client.searchForStudies(
          options,
        )) as unknown as DicomJsonObject[],
    )
    return merged as unknown as dwc.api.Study[]
  }

  searchForSeries = async (
    options: dwc.api.SearchForSeriesOptions,
  ): Promise<dwc.api.Series[]> => {
    const merged = await searchAcrossStores(
      this.stores,
      [STUDY_INSTANCE_UID_TAG, SERIES_INSTANCE_UID_TAG],
      async (store) =>
        (await store.client.searchForSeries(
          options,
        )) as unknown as DicomJsonObject[],
    )
    return merged as unknown as dwc.api.Series[]
  }

  searchForInstances = async (
    options: dwc.api.SearchForInstancesOptions,
  ): Promise<dwc.api.Instance[]> => {
    const merged = await searchAcrossStores(
      this.stores,
      [STUDY_INSTANCE_UID_TAG, SERIES_INSTANCE_UID_TAG, SOP_INSTANCE_UID_TAG],
      async (store) =>
        (await store.client.searchForInstances(
          options,
        )) as unknown as DicomJsonObject[],
    )
    return merged as unknown as dwc.api.Instance[]
  }

  retrieveStudyMetadata = async (
    options: dwc.api.RetrieveStudyMetadataOptions,
  ): Promise<dwc.api.Metadata[]> => {
    const studySummaryMetadata = await retrieveWithFallback(
      this.stores,
      async (store) => await store.client.retrieveStudyMetadata(options),
    )
    const naturalized = naturalizeDataset(studySummaryMetadata)
    DicomMetadataStore.addStudy(naturalized as Record<string, unknown>)
    return studySummaryMetadata
  }

  retrieveSeriesMetadata = async (
    options: dwc.api.RetrieveSeriesMetadataOptions,
  ): Promise<dwc.api.Metadata[]> => {
    const seriesSummaryMetadata = await retrieveWithFallback(
      this.stores,
      async (store) => await store.client.retrieveSeriesMetadata(options),
    )
    const naturalized = seriesSummaryMetadata.map(naturalizeDataset)
    DicomMetadataStore.addSeriesMetadata(
      naturalized as Array<Record<string, unknown>>,
      true,
    )
    return seriesSummaryMetadata
  }

  retrieveInstanceMetadata = async (
    options: dwc.api.RetrieveInstanceMetadataOptions,
  ): Promise<dwc.api.Metadata[]> => {
    return await retrieveWithFallback(
      this.stores,
      async (store) => await store.client.retrieveInstanceMetadata(options),
    )
  }

  retrieveInstance = async (
    options: dwc.api.RetrieveInstanceOptions,
  ): Promise<dwc.api.Dataset> => {
    const instance = await retrieveWithFallback(
      this.stores,
      async (store) => await store.client.retrieveInstance(options),
    )
    const data = dcmjs.data.DicomMessage.readFile(instance)
    const { dataset } = dmv.metadata.formatMetadata(data.dict)
    DicomMetadataStore.addInstances([dataset as Instance])
    return instance
  }

  retrieveInstanceFrames = async (
    options: dwc.api.RetrieveInstanceFramesOptions,
  ): Promise<dwc.api.Pixeldata[]> => {
    return await retrieveWithFallback(
      this.stores,
      async (store) => await store.client.retrieveInstanceFrames(options),
    )
  }

  retrieveInstanceRendered = async (
    options: dwc.api.RetrieveInstanceRenderedOptions,
  ): Promise<dwc.api.Pixeldata> => {
    return await retrieveWithFallback(
      this.stores,
      async (store) => await store.client.retrieveInstanceRendered(options),
    )
  }

  retrieveInstanceFramesRendered = async (
    options: dwc.api.RetrieveInstanceFramesRenderedOptions,
  ): Promise<dwc.api.Pixeldata> => {
    return await retrieveWithFallback(
      this.stores,
      async (store) =>
        await store.client.retrieveInstanceFramesRendered(options),
    )
  }

  retrieveBulkData = async (
    options: dwc.api.RetrieveBulkDataOptions,
  ): Promise<dwc.api.Bulkdata[]> => {
    return await retrieveWithFallback(
      this.stores,
      async (store) => await store.client.retrieveBulkData(options),
    )
  }
}

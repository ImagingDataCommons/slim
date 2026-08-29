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
import { getOrigin } from './utils/authPolicy'
import { CustomError, errorTypes } from './utils/CustomError'
import { createSingleFlight } from './utils/singleFlight'
import { joinUrl } from './utils/url'
import getXHRRetryHook from './utils/xhrRetryHook'

const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary

/**
 * How the OIDC access token is handled for a store.
 *
 * - `always`: attach it to every request (`sendAuthorization: true`).
 * - `never`: never attach it (`sendAuthorization: false`).
 * - `auto`:  start anonymous and escalate only if the server answers 401/403.
 *
 * `auto` is the default. Staying anonymous until challenged keeps requests
 * CORS-simple and means an open server never sees the token at all.
 */
type AuthorizationMode = 'always' | 'never' | 'auto'

interface Store {
  id: string
  read: boolean
  write: boolean
  /** Origin of the service URL; the unit at which consent is recorded. */
  origin: string
  authMode: AuthorizationMode
  /** Whether the token may currently be attached to this store. */
  authGranted: boolean
  /** Set once escalation has been refused, so it is not attempted again. */
  authRefused: boolean
  /** Set once the withheld-credential notice was shown, to report it once. */
  authRefusalReported: boolean
  client: dwc.api.DICOMwebClient
  settings: ServerSettings
}

/**
 * Decides whether the user's access token may be sent to a given origin.
 * Implemented by the application, which owns the remembered decisions and the
 * consent prompt; the manager only asks.
 */
export interface AuthorizationPolicy {
  /** Whether this origin was already approved, so no request need be refused first. */
  isPreAuthorized: (origin: string) => boolean
  /**
   * Obtain a token for this origin after a 401/403, prompting the user if the
   * origin is not already trusted. Resolves to undefined if the token must not
   * be sent.
   */
  requestAuthorization: (origin: string) => Promise<string | undefined>
}

/**
 * Headers that carry the user's OIDC credentials and are therefore subject to
 * the per-store authorization mode rather than propagated unconditionally.
 */
const AUTH_HEADER_NAMES = new Set(['authorization'])

/** Statuses that indicate a server wants credentials we have not yet sent. */
const AUTH_CHALLENGE_STATUSES = new Set([401, 403])

const getErrorStatus = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : undefined
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

/**
 * Cache mapping series UIDs to the store that successfully served them.
 * Keyed by "studyInstanceUID/seriesInstanceUID".
 */
const seriesStoreCache = new Map<string, Store>()

/**
 * Build the cache key for a series.
 */
const buildSeriesCacheKey = (
  studyInstanceUID: string,
  seriesInstanceUID: string,
): string => `${studyInstanceUID}/${seriesInstanceUID}`

/**
 * Try stores in an optimized order: if a cached store exists for the given
 * series, try it first to avoid 404s on other stores. Falls back to the
 * standard order if the cached store fails or no cache exists.
 *
 * On success, caches the store for subsequent requests to the same series.
 */
const retrieveWithCachedFallback = async <T>(
  stores: Store[],
  call: (store: Store) => Promise<T>,
  cacheKey?: string,
): Promise<T> => {
  const readable = stores.filter((s) => s.read)
  if (readable.length === 0) {
    throw new CustomError(
      errorTypes.COMMUNICATION,
      'No readable DICOMweb store is configured.',
    )
  }

  /** Reorder stores to try the cached one first if available. */
  let orderedStores = readable
  const cachedStore = cacheKey != null ? seriesStoreCache.get(cacheKey) : null
  if (cachedStore != null && readable.includes(cachedStore)) {
    orderedStores = [cachedStore, ...readable.filter((s) => s !== cachedStore)]
  }

  let lastError: unknown
  for (const store of orderedStores) {
    try {
      const result = await call(store)
      /** Cache the successful store for future requests to this series. */
      if (cacheKey != null) {
        seriesStoreCache.set(cacheKey, store)
      }
      return result
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

  private authorizationPolicy?: AuthorizationPolicy

  /** Most recent token, retained so a later grant can be applied immediately. */
  private currentAuthorization?: string

  /**
   * Collapses escalations by origin. Parallel requests to the same server
   * routinely fail together; without this the policy would be asked once per
   * failed request instead of once per server. The policy collapses across
   * managers too, since each storage class has its own.
   */
  private readonly authorizationGate = createSingleFlight<string | undefined>()

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

      /** Index this store will occupy; lets the interceptor find its state. */
      const storeIndex = this.stores.length

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
        const store = this.stores[storeIndex]
        if (store !== undefined && this.isAnonymousChallenge(store, error)) {
          /**
           * The store was queried anonymously and the server asked for
           * credentials. `callStore` owns this case: it escalates if it can and
           * reports the withheld credential if it cannot. Passing it to the
           * general handler would additionally trigger the expired-token
           * recovery, which does not apply here.
           */
          return
        }
        this.handleError(error, serverSettings)
      }

      let authMode: AuthorizationMode = 'auto'
      if (serverSettings.sendAuthorization === true) {
        authMode = 'always'
      } else if (serverSettings.sendAuthorization === false) {
        authMode = 'never'
      }

      this.stores.push({
        id: serverSettings.id,
        write: serverSettings.write ?? false,
        read: serverSettings.read ?? true,
        origin: getOrigin(serviceUrl) ?? serviceUrl,
        authMode,
        authGranted: authMode === 'always',
        authRefused: false,
        authRefusalReported: false,
        client: new dwc.api.DICOMwebClient(clientSettings),
        settings: serverSettings,
      })
    })
  }

  get baseURL(): string {
    return this.stores[0].client.baseURL
  }

  /**
   * Install the policy that decides which origins may receive the access token.
   * Stores whose origin was already approved in an earlier session pick the
   * token up immediately, so those servers never see an anonymous request.
   */
  setAuthorizationPolicy = (policy: AuthorizationPolicy): void => {
    this.authorizationPolicy = policy
    if (this.currentAuthorization !== undefined) {
      this.updateHeaders({ Authorization: this.currentAuthorization })
    }
  }

  /**
   * Whether the token may be attached to this store right now.
   *
   * For `auto` stores this consults the policy, so an origin the user approved
   * in an earlier session is credentialed from the first request rather than
   * after another refusal.
   */
  private readonly mayAttachAuthorization = (store: Store): boolean => {
    if (store.authMode === 'always') {
      return true
    }
    if (store.authMode === 'never' || store.authRefused) {
      return false
    }
    if (store.authGranted) {
      return true
    }
    if (this.authorizationPolicy?.isPreAuthorized(store.origin) === true) {
      store.authGranted = true
      return true
    }
    return false
  }

  /**
   * Whether a server refused a request that we deliberately sent without
   * credentials.
   *
   * This is distinct from a 401 against a credentialed store, which means the
   * token expired. These must not be conflated: the application responds to the
   * latter by renewing the session, up to an interactive redirect to the
   * identity provider. Doing that here would drag the user through a sign-in
   * they may have just declined, and could not help anyway — the request failed
   * because the credential was withheld, not because it was stale.
   */
  private readonly isAnonymousChallenge = (
    store: Store,
    error: unknown,
  ): boolean => {
    const status = getErrorStatus(error)
    return (
      status !== undefined &&
      AUTH_CHALLENGE_STATUSES.has(status) &&
      store.authMode !== 'always' &&
      !store.authGranted
    )
  }

  /**
   * Whether such a challenge can still be escalated from, i.e. the store is
   * negotiating, has not already been refused, and a policy exists to ask.
   */
  private readonly isAuthChallenge = (store: Store, error: unknown): boolean =>
    this.isAnonymousChallenge(store, error) &&
    store.authMode === 'auto' &&
    !store.authRefused &&
    this.authorizationPolicy !== undefined

  /**
   * Tell the user their token was withheld from a server that wants it, once
   * per store. Reported directly rather than through the DICOMweb error
   * handler, which would treat the 401 as an expired session and start a
   * pointless re-authentication.
   */
  private readonly reportWithheldAuthorization = (store: Store): void => {
    if (store.authRefusalReported) {
      return
    }
    store.authRefusalReported = true
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.DICOMWEB,
      new CustomError(
        errorTypes.COMMUNICATION,
        `The DICOMweb server at ${store.origin} requires sign-in, but your ` +
          'access token was not sent to it.',
      ),
    )
  }

  /**
   * Ask the policy for a token for this store's origin, collapsing concurrent
   * requests so the user is prompted once per server rather than once per
   * failed DICOMweb call.
   */
  private readonly resolveAuthorization = async (
    store: Store,
  ): Promise<string | undefined> => {
    const policy = this.authorizationPolicy
    if (policy === undefined) {
      return undefined
    }
    return await this.authorizationGate(
      store.origin,
      async () => await policy.requestAuthorization(store.origin),
    )
  }

  /**
   * Run a DICOMweb call against one store, escalating from anonymous to
   * authenticated if the server demands credentials and the user allows it.
   *
   * The call is retried at most once, and only after a 401/403 — so nothing was
   * stored or returned on the first attempt and re-sending is safe even for
   * STOW-RS.
   */
  private readonly callStore = async <T>(
    store: Store,
    call: (client: dwc.api.DICOMwebClient) => Promise<T>,
  ): Promise<T> => {
    try {
      return await call(store.client)
    } catch (error: unknown) {
      if (!this.isAuthChallenge(store, error)) {
        if (this.isAnonymousChallenge(store, error)) {
          /**
           * Already refused, or configured `sendAuthorization: false` against a
           * server that wants credentials. The interceptor stayed quiet, so say
           * so here.
           */
          this.reportWithheldAuthorization(store)
        }
        throw error
      }
      const authorization = await this.resolveAuthorization(store)
      if (authorization === undefined) {
        /** Consent refused, or no token exists to send. */
        store.authRefused = true
        this.reportWithheldAuthorization(store)
        throw error
      }
      store.authGranted = true
      /**
       * Apply through the normal path rather than writing this one client's
       * header. The grant is recorded per origin, so every other store the
       * policy now permits — a sibling on the same origin, or one approved
       * earlier — picks the token up here instead of each having to be refused
       * once first. Per-store filtering still applies, so an open or refused
       * store is untouched.
       */
      this.updateHeaders({ Authorization: authorization })
      return await call(store.client)
    }
  }

  /**
   * Update auth (or other) headers on every wrapped store so token refreshes
   * propagate to the primary AND secondary endpoints.
   *
   * Credential headers are filtered per store: a server configured as open, or
   * one that has not yet been approved for this origin, keeps receiving
   * anonymous requests. Non-credential headers propagate to every store.
   */
  updateHeaders = (fields: { [name: string]: string }): void => {
    for (const f in fields) {
      const isAuthHeader = AUTH_HEADER_NAMES.has(f.toLowerCase())
      if (isAuthHeader) {
        this.currentAuthorization = fields[f]
      }
      for (const store of this.stores) {
        if (isAuthHeader && !this.mayAttachAuthorization(store)) {
          continue
        }
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
    return await this.callStore(
      writable,
      async (client) => await client.storeInstances(options),
    )
  }

  searchForStudies = async (
    options: dwc.api.SearchForStudiesOptions,
  ): Promise<dwc.api.Study[]> => {
    const merged = await searchAcrossStores(
      this.stores,
      [STUDY_INSTANCE_UID_TAG],
      async (store) =>
        await this.callStore(
          store,
          async (client) =>
            (await client.searchForStudies(
              options,
            )) as unknown as DicomJsonObject[],
        ),
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
        await this.callStore(
          store,
          async (client) =>
            (await client.searchForSeries(
              options,
            )) as unknown as DicomJsonObject[],
        ),
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
        await this.callStore(
          store,
          async (client) =>
            (await client.searchForInstances(
              options,
            )) as unknown as DicomJsonObject[],
        ),
    )
    return merged as unknown as dwc.api.Instance[]
  }

  retrieveStudyMetadata = async (
    options: dwc.api.RetrieveStudyMetadataOptions,
  ): Promise<dwc.api.Metadata[]> => {
    const studySummaryMetadata = await retrieveWithFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) => await client.retrieveStudyMetadata(options),
        ),
    )
    const naturalized = naturalizeDataset(studySummaryMetadata)
    DicomMetadataStore.addStudy(naturalized as Record<string, unknown>)
    return studySummaryMetadata
  }

  retrieveSeriesMetadata = async (
    options: dwc.api.RetrieveSeriesMetadataOptions,
  ): Promise<dwc.api.Metadata[]> => {
    const cacheKey = buildSeriesCacheKey(
      options.studyInstanceUID,
      options.seriesInstanceUID,
    )
    const seriesSummaryMetadata = await retrieveWithCachedFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) => await client.retrieveSeriesMetadata(options),
        ),
      cacheKey,
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
    const cacheKey = buildSeriesCacheKey(
      options.studyInstanceUID,
      options.seriesInstanceUID,
    )
    return await retrieveWithCachedFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) => await client.retrieveInstanceMetadata(options),
        ),
      cacheKey,
    )
  }

  retrieveInstance = async (
    options: dwc.api.RetrieveInstanceOptions,
  ): Promise<dwc.api.Dataset> => {
    const cacheKey = buildSeriesCacheKey(
      options.studyInstanceUID,
      options.seriesInstanceUID,
    )
    const instance = await retrieveWithCachedFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) => await client.retrieveInstance(options),
        ),
      cacheKey,
    )
    const data = dcmjs.data.DicomMessage.readFile(instance)
    const { dataset } = dmv.metadata.formatMetadata(data.dict)
    DicomMetadataStore.addInstances([dataset as Instance])
    return instance
  }

  retrieveInstanceFrames = async (
    options: dwc.api.RetrieveInstanceFramesOptions,
  ): Promise<dwc.api.Pixeldata[]> => {
    const cacheKey = buildSeriesCacheKey(
      options.studyInstanceUID,
      options.seriesInstanceUID,
    )
    return await retrieveWithCachedFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) => await client.retrieveInstanceFrames(options),
        ),
      cacheKey,
    )
  }

  retrieveInstanceRendered = async (
    options: dwc.api.RetrieveInstanceRenderedOptions,
  ): Promise<dwc.api.Pixeldata> => {
    const cacheKey = buildSeriesCacheKey(
      options.studyInstanceUID,
      options.seriesInstanceUID,
    )
    return await retrieveWithCachedFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) => await client.retrieveInstanceRendered(options),
        ),
      cacheKey,
    )
  }

  retrieveInstanceFramesRendered = async (
    options: dwc.api.RetrieveInstanceFramesRenderedOptions,
  ): Promise<dwc.api.Pixeldata> => {
    const cacheKey = buildSeriesCacheKey(
      options.studyInstanceUID,
      options.seriesInstanceUID,
    )
    return await retrieveWithCachedFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) =>
            await client.retrieveInstanceFramesRendered(options),
        ),
      cacheKey,
    )
  }

  retrieveBulkData = async (
    options: dwc.api.RetrieveBulkDataOptions,
  ): Promise<dwc.api.Bulkdata[]> => {
    return await retrieveWithFallback(
      this.stores,
      async (store) =>
        await this.callStore(
          store,
          async (client) => await client.retrieveBulkData(options),
        ),
    )
  }
}

import type AppConfig from '../AppConfig'
import type { DicomWebManagerErrorHandler, ServerSettings } from '../AppConfig'
import type { AuthorizationPolicy } from '../DicomWebManager'
import DicomWebManager from '../DicomWebManager'
import { StorageClasses } from '../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { getOrigin } from '../utils/authPolicy'
import { CustomError, errorTypes } from '../utils/CustomError'
import { getProjectStorePath, isProjectsPath } from '../utils/routes'
import { normalizeServerUrl } from '../utils/url'

export type ClientMapping = { [sopClassUID: string]: DicomWebManager }

export const DEFAULT_GCP_BASE_URL = 'https://healthcare.googleapis.com/v1'

export const GCP_SECONDARY_SERVER_ID = 'gcp_secondary_annotation_server'

/** Derived data classes routed to the `?gcp=` store */
export const GCP_SECONDARY_STORAGE_CLASSES: readonly string[] = [
  StorageClasses.COMPREHENSIVE_SR,
  StorageClasses.COMPREHENSIVE_3D_SR,
  StorageClasses.SEGMENTATION,
  StorageClasses.LABELMAP_SEGMENTATION,
  StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION,
  StorageClasses.PARAMETRIC_MAP,
  StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE,
  StorageClasses.COLOR_SOFTCOPY_PRESENTATION_STATE,
  StorageClasses.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE,
  StorageClasses.PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE,
]

/** Append the `?gcp=` store to the configured servers, once */
export function addGcpSecondaryAnnotationServer(
  config: Pick<AppConfig, 'servers'>,
  search: string,
): void {
  const url = new URLSearchParams(search).get('gcp')
  const existing = config.servers.find(
    (server) => server.id === GCP_SECONDARY_SERVER_ID,
  )
  if (existing === undefined && typeof url === 'string') {
    config.servers.push({
      id: GCP_SECONDARY_SERVER_ID,
      write: true,
      url,
      storageClasses: [...GCP_SECONDARY_STORAGE_CLASSES],
    })
  }
}

export function createClientMapping({
  baseUri,
  gcpBaseUrl,
  settings,
  pathname,
  onError,
}: {
  baseUri: string
  gcpBaseUrl: string
  settings: ServerSettings[]
  /** Current route; `/projects/` routes point the default server at that store */
  pathname: string
  onError: DicomWebManagerErrorHandler
}): ClientMapping {
  const storageClassMapping: { [key: string]: number } = { default: 0 }
  const clientMapping: ClientMapping = {}

  const defaultServers: ServerSettings[] = []

  settings.forEach((serverSettings) => {
    if (serverSettings.storageClasses != null) {
      serverSettings.storageClasses.forEach((sopClassUID) => {
        if (Object.values<string>(StorageClasses).includes(sopClassUID)) {
          if (sopClassUID in storageClassMapping) {
            storageClassMapping[sopClassUID] += 1
          } else {
            storageClassMapping[sopClassUID] = 1
          }
        } else {
          console.warn(
            `unknown storage class "${sopClassUID}" specified ` +
              `for configured server "${serverSettings.id}"`,
          )
        }
      })
    } else {
      if (isProjectsPath(pathname)) {
        const storePath = getProjectStorePath(pathname)
        serverSettings.url = `${gcpBaseUrl}${storePath}/dicomWeb`
      }

      storageClassMapping.default += 1
      defaultServers.push(serverSettings)
      clientMapping.default = new DicomWebManager({
        baseUri,
        settings: [serverSettings],
        onError,
      })
    }
  })

  if (storageClassMapping.default > 1) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(
        errorTypes.COMMUNICATION,
        'Only one default server can be configured without specification ' +
          'of storage classes.',
      ),
    )
  }

  /**
   * For each storage class explicitly assigned to a non-default server, wrap
   * BOTH the default server and the specialty server(s) in the same manager.
   *
   * This makes derived data (SR/SEG/ANN/PM/PR) load from the primary store
   * AND the secondary `gcp=` URL store at the same time (GH-320). Without
   * this, specifying `gcp=` previously caused the default store to be
   * skipped for those classes and SLIM only saw the secondary's derived data.
   */
  if (Object.keys(storageClassMapping).length > 1) {
    const classToServers = new Map<string, ServerSettings[]>()
    settings.forEach((server) => {
      if (server.storageClasses != null) {
        server.storageClasses.forEach((sopClassUID) => {
          const list = classToServers.get(sopClassUID) ?? []
          list.push(server)
          classToServers.set(sopClassUID, list)
        })
      }
    })

    classToServers.forEach((specialtyServers, sopClassUID) => {
      const combinedServers = [...defaultServers, ...specialtyServers]
      clientMapping[sopClassUID] = new DicomWebManager({
        baseUri,
        settings: combinedServers,
        onError,
      })
    })
  }

  Object.values(StorageClasses).forEach((sopClassUID) => {
    if (!(sopClassUID in clientMapping)) {
      clientMapping[sopClassUID] = clientMapping.default
    }
  })
  return clientMapping
}

/**
 * Origins of the configured servers. Read after `createClientMapping`, which
 * rewrites `url` in place on `/projects/` routes, to capture the effective value.
 */
export function collectConfiguredOrigins(
  servers: ServerSettings[],
  baseUri: string,
): Set<string> {
  return new Set(
    servers
      .map((server) => (server.url != null ? getOrigin(server.url) : baseUri))
      .filter((origin): origin is string => origin !== undefined),
  )
}

/** Install the authorization policy on every distinct manager in a mapping. */
export function applyAuthorizationPolicy(
  clients: ClientMapping,
  policy: AuthorizationPolicy,
): void {
  for (const client of new Set(Object.values(clients))) {
    client.setAuthorizationPolicy(policy)
  }
}

/** Offer a token to every manager; each one filters it per store. */
export function updateAuthorization(
  clients: ClientMapping,
  authorization: string,
): void {
  for (const key of Object.keys(clients)) {
    clients[key].updateHeaders({ Authorization: authorization })
  }
}

/**
 * URL of the custom server to switch to, or undefined to use the configured
 * servers: an empty entry, or default mode chosen in server selection.
 */
export function resolveCustomServerUrl(
  url: string,
  storedMode: string | null,
): string | undefined {
  const trimmedUrl = url.trim()
  if (trimmedUrl === '' || storedMode === 'default') {
    return undefined
  }
  return normalizeServerUrl(trimmedUrl)
}

/**
 * Use one read-only client for every storage class. We may want to make this
 * more sophisticated in the future to allow users to override the entire
 * server configuration.
 */
export function mapAllStorageClasses(
  clients: ClientMapping,
  client: DicomWebManager,
): ClientMapping {
  const mapped: ClientMapping = {}
  for (const key in clients) {
    mapped[key] = client
  }
  return mapped
}

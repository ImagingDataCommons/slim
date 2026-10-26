export const GCP_HEALTHCARE_V1_BASE = 'https://healthcare.googleapis.com/v1'

const GCP_DICOM_WEB_SUFFIX = '/dicomWeb'

/** GCP store resource path with optional repeated /dicomWeb suffix (any casing). */
const GCP_STORE_PATH_PATTERN = /^(.+\/dicomStores\/[^/]+)(?:\/dicomWeb)*$/i

/**
 * Ensure a pathname ends with exactly one /dicomWeb when it targets a GCP DICOM store.
 * Leaves non-GCP paths unchanged.
 */
const ensureGcpDicomWebOnPath = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '')
  if (!trimmed.includes('/dicomStores/')) {
    return trimmed
  }

  const match = trimmed.match(GCP_STORE_PATH_PATTERN)
  if (match) {
    return `${match[1]}${GCP_DICOM_WEB_SUFFIX}`
  }

  return trimmed
}

/** Normalize GCP DICOMweb base URLs: add /dicomWeb when missing, dedupe when repeated. */
const ensureGcpDicomWebSuffix = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      parsed.pathname = ensureGcpDicomWebOnPath(parsed.pathname)
      return parsed.toString()
    } catch (_TypeError) {
      return ensureGcpDicomWebOnPath(url)
    }
  }

  return ensureGcpDicomWebOnPath(url)
}

/**
 * Normalize server URL. Path-only input (no domain) is prepended with GCP Healthcare v1 base
 * so users can paste GCP DICOM store paths without the full domain. GCP store paths that omit
 * the DICOMweb endpoint get /dicomWeb appended automatically.
 */
export const normalizeServerUrl = (input: string): string => {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return ensureGcpDicomWebSuffix(trimmed)
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return ensureGcpDicomWebSuffix(`${GCP_HEALTHCARE_V1_BASE}${path}`)
}

/**
 * Join a URI with a path to form a full URL.
 *
 * @param path - Path component
 * @param uri - Base URI to which the path component should be added
 */
export const joinUrl = (path: string, uri: string): string => {
  let baseUri = uri
  if (!baseUri.endsWith('/')) {
    baseUri += '/'
  }
  const url = new URL(path, baseUri)
  return url.toString()
}

/** Parameters of an authorize response that grants a code or an ID token */
const AUTH_GRANT_KEYS = ['code', 'id_token', 'session_state']

/** Parameters of a URL fragment such as `#access_token=…&state=…` */
export const hashParams = (hash: string): URLSearchParams =>
  new URLSearchParams(hash.replace('#', '?'))

/** Query or fragment parameters of a location */
const locationParams = (location: {
  search: string
  hash: string
}): URLSearchParams[] => [
  new URLSearchParams(location.search),
  hashParams(location.hash),
]

const hasAny = (params: URLSearchParams, keys: readonly string[]): boolean =>
  keys.some((key) => Boolean(params.get(key)))

/**
 * Whether query or fragment parameters are an authorize response, success
 * or error. The one rule for "is this a sign-in callback": the app shell
 * routes by it, and the viewer strips such parameters before writing the
 * URL back. A bare `error` counts, as a silent renew can answer
 * `error=login_required` without a `state`.
 */
export const isAuthResponseParams = (params: URLSearchParams): boolean =>
  hasAny(params, [...AUTH_GRANT_KEYS, 'access_token', 'error'])

/**
 * Check whether a URL contains an OAuth 2.0 authorization code.
 *
 * @param location - URL components (JavaScript location object)
 * @returns Whether the URL contains a code
 */
export const isAuthorizationCodeInUrl = (location: {
  search: string
  hash: string
}): boolean =>
  locationParams(location).some((params) => hasAny(params, AUTH_GRANT_KEYS))

/**
 * True when the URL looks like an OIDC authorize redirect back to the app
 * (success or error). Used to detect silent-renew iframe callbacks that must
 * not boot the React SPA (including `error=login_required` responses that
 * lack code/id_token/session_state).
 */
export const isOidcAuthorizeCallbackUrl = (location: {
  search: string
  hash: string
}): boolean => locationParams(location).some(isAuthResponseParams)

/**
 * For a callback-shaped URL that carries no `state`, which no pending request
 * can match, the message to show: the IdP's error_description or error when
 * present. Undefined when the URL has a code or tokens, or a `state` the
 * sign-in library should match (it reports error responses itself).
 */
export const describeCallbackWithoutState = (location: {
  search: string
  hash: string
}): string | undefined => {
  const searchParams = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(location.hash.replace('#', '?'))
  const read = (key: string): string | null =>
    searchParams.get(key) ?? hashParams.get(key)
  if (isAuthorizationCodeInUrl(location) || read('state') !== null) {
    return undefined
  }
  const reason = read('error_description') ?? read('error')
  return reason !== null && reason !== ''
    ? `Sign-in failed: ${reason}`
    : 'Sign-in was cancelled or failed.'
}

/** Decoded name of one raw `name=value` query segment */
const segmentName = (segment: string): string => {
  const name = segment.split('=')[0].replace(/\+/g, ' ')
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

/**
 * Remove or set query parameters while keeping every other segment exactly
 * as written, so values such as a `gcp` store URL are not re-encoded.
 * Returns `?…`, or an empty string when no parameter is left.
 */
export const editSearch = (
  search: string,
  {
    remove = [],
    set,
  }: { remove?: readonly string[]; set?: readonly [string, string] },
): string => {
  const segments: string[] = []
  let isSet = false
  for (const segment of search.replace(/^\?/, '').split('&')) {
    const name = segmentName(segment)
    if (segment === '' || remove.includes(name)) continue
    if (set !== undefined && name === set[0]) {
      /** Set in place, once, so the order and the URL stay stable */
      if (!isSet) {
        segments.push(
          `${encodeURIComponent(set[0])}=${encodeURIComponent(set[1])}`,
        )
        isSet = true
      }
      continue
    }
    segments.push(segment)
  }
  if (set !== undefined && !isSet) {
    segments.push(`${encodeURIComponent(set[0])}=${encodeURIComponent(set[1])}`)
  }
  return segments.length > 0 ? `?${segments.join('&')}` : ''
}

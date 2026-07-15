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

/**
 * Check whether a URL contains an OAuth 2.0 authorization code.
 *
 * @param location - URL components (JavaScript location object)
 * @returns Whether the URL contains a code
 */
export const isAuthorizationCodeInUrl = (location: {
  search: string
  hash: string
}): boolean => {
  const searchParams = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(location.hash.replace('#', '?'))

  return Boolean(
    searchParams.get('code') ??
      searchParams.get('id_token') ??
      searchParams.get('session_state') ??
      hashParams.get('code') ??
      hashParams.get('id_token') ??
      hashParams.get('session_state'),
  )
}

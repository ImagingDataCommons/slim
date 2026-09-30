/**
 * Pure functions for server URL validation and parsing.
 * No side effects - suitable for unit testing.
 */

/** GCP DICOM store path pattern */
const GCP_DICOM_STORE_REGEX =
  /^\/projects\/[^/]+\/locations\/[^/]+\/datasets\/[^/]+\/dicomStores\/[^/]+$/

/**
 * Checks if a path matches the GCP DICOM store format.
 */
export function isGcpDicomStorePath(path: string): boolean {
  return GCP_DICOM_STORE_REGEX.test(path)
}

/**
 * Validates whether a URL string is a valid server URL.
 * Accepts full HTTP(S) URLs or GCP DICOM store paths.
 */
export function isValidServerUrl(url: string | null | undefined): boolean {
  if (url == null || url === '') {
    return false
  }
  const trimmedUrl = url.trim()
  if (trimmedUrl === '') {
    return false
  }

  /** Check for HTTP/HTTPS URLs */
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    try {
      const urlObj = new URL(trimmedUrl)
      return urlObj.protocol.startsWith('http') && urlObj.pathname.length > 0
    } catch {
      return false
    }
  }

  /** Check for GCP path format */
  const pathNorm = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`
  return isGcpDicomStorePath(pathNorm)
}

/**
 * Normalizes a server URL by ensuring consistent formatting.
 */
export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim()

  /** If it's a GCP path, return as-is with leading slash */
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }

  try {
    const urlObj = new URL(trimmed)
    /** Remove trailing slash for consistency */
    let normalized = urlObj.href
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  } catch {
    return trimmed
  }
}

/**
 * Extracts the hostname from a URL for display purposes.
 */
export function extractHostname(url: string): string {
  const trimmed = url.trim()

  /** Handle GCP paths */
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    /** Extract project name from GCP path */
    const match = trimmed.match(/\/projects\/([^/]+)/)
    if (match) {
      return `GCP: ${match[1]}`
    }
    return trimmed
  }

  try {
    const urlObj = new URL(trimmed)
    return urlObj.hostname
  } catch {
    return trimmed
  }
}

/**
 * Parses a URL and returns its components, or null if invalid.
 */
export function parseServerUrl(url: string): {
  isGcp: boolean
  hostname: string
  fullUrl: string
} | null {
  if (!isValidServerUrl(url)) {
    return null
  }

  const trimmed = url.trim()
  const isGcp =
    !trimmed.startsWith('http://') && !trimmed.startsWith('https://')

  return {
    isGcp,
    hostname: extractHostname(trimmed),
    fullUrl: normalizeServerUrl(trimmed),
  }
}

import { isGcpDicomStorePath } from '../../../utils/routes'

/**
 * Validates whether a URL string is a valid server URL: an HTTP(S) URL
 * (DICOMweb may be served at the origin root) or a GCP DICOM store path.
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
      return new URL(trimmedUrl).protocol.startsWith('http')
    } catch {
      return false
    }
  }

  /** Check for GCP path format */
  const pathNorm = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`
  return isGcpDicomStorePath(pathNorm)
}

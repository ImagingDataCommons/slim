import { isGcpDicomStorePath } from '../../../utils/routes'

/**
 * Validates whether a URL string is a valid server URL: an HTTP(S) URL with
 * a path beyond the bare origin, or a GCP DICOM store path.
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
      return (
        urlObj.protocol.startsWith('http') &&
        urlObj.pathname !== '' &&
        urlObj.pathname !== '/'
      )
    } catch {
      return false
    }
  }

  /** Check for GCP path format */
  const pathNorm = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`
  return isGcpDicomStorePath(pathNorm)
}

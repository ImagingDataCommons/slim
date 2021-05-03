/**
 * Join a URI with a path to form a full URL.
 *
 * @params path - Path component
 * @params uri - Base URI to which the path component should be added
 */
export const joinUrl = (path: string, uri: string): string => {
  const url = new URL(path, uri)
  return url.toString()
}

/**
 * Check whether a URL contains an OAuth 2.0 authorization code.
 *
 * @params location - URL components (JavaScript location object)
 * @returns Whether the URL contains a code
 */
export const isAuthorizationCodeInUrl = (location: {
  search: string,
  hash: string
}): boolean => {
  const searchParams = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(location.hash.replace('#', '?'))

  return Boolean(
    searchParams.get('code') ||
      searchParams.get('id_token') ||
      searchParams.get('session_state') ||
      hashParams.get('code') ||
      hashParams.get('id_token') ||
      hashParams.get('session_state')
  )
}

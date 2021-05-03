export const joinUrl = (path: string, uri: string): string => {
  const url = new URL(path, uri)
  return url.toString()
}

export const hasCodeInUrl = (location: {
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

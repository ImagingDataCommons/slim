export const IMPLICIT_RESPONSE_TYPE = 'id_token token'

export interface ImplicitAuthorizeRequest {
  authorizationEndpoint: string
  clientId: string
  redirectUri: string
  scope: string
  state: string
  nonce: string
  prompt?: string
  idTokenHint?: string
}

export const buildImplicitAuthorizeUrl = (
  request: ImplicitAuthorizeRequest,
): string => {
  const url = new URL(request.authorizationEndpoint)
  url.searchParams.set('client_id', request.clientId)
  url.searchParams.set('redirect_uri', request.redirectUri)
  url.searchParams.set('response_type', IMPLICIT_RESPONSE_TYPE)
  url.searchParams.set('scope', request.scope)
  url.searchParams.set('state', request.state)
  url.searchParams.set('nonce', request.nonce)
  if (request.prompt !== undefined) {
    url.searchParams.set('prompt', request.prompt)
  }
  if (request.idTokenHint !== undefined) {
    url.searchParams.set('id_token_hint', request.idTokenHint)
  }
  return url.toString()
}

export interface ImplicitCallback {
  state: string | null
  accessToken: string | null
  tokenType: string | null
  expiresIn: number | undefined
  idToken: string | null
  scope: string | null
  sessionState: string | null
  error: string | null
  errorDescription: string | null
}

/**
 * Implicit responses are returned in the URL fragment; some providers report
 * errors in the query instead, so both are read with the fragment first.
 */
export const parseImplicitCallback = (url: string): ImplicitCallback => {
  const parsed = new URL(url)
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const read = (key: string): string | null =>
    fragment.get(key) ?? parsed.searchParams.get(key)
  const expiresIn = Number.parseInt(read('expires_in') ?? '', 10)
  return {
    state: read('state'),
    accessToken: read('access_token'),
    tokenType: read('token_type'),
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
    idToken: read('id_token'),
    scope: read('scope'),
    sessionState: read('session_state'),
    error: read('error'),
    errorDescription: read('error_description'),
  }
}

import {
  type IdTokenClaims,
  type MetadataService,
  type SigningKey,
  type StateStore,
  User,
  type UserManagerEvents,
  type UserManagerSettingsStore,
} from 'oidc-client-ts'
import { v4 as generateUuid } from 'uuid'

import { isOidcAuthorizeCallbackUrl } from '../utils/url'

export const IMPLICIT_RESPONSE_TYPE = 'id_token token'

/** Same as the oidc-client-ts default `silentRequestTimeoutInSeconds` */
const SILENT_RENEW_TIMEOUT_MS = 10_000

/** Leeway for ID token expiry, as in oidc-client 1.x */
const CLOCK_SKEW_SECONDS = 300

const REDIRECT_REQUEST_TYPE = 'si:r'
const SILENT_REQUEST_TYPE = 'si:s'

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const decodeBase64UrlToBinary = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  )
  return window.atob(padded)
}

const decodeBase64Url = (input: string): string => {
  const percentEncoded = Array.from(
    decodeBase64UrlToBinary(input),
    (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
  ).join('')
  return decodeURIComponent(percentEncoded)
}

const binaryToBytes = (binary: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(binary, (char) => char.charCodeAt(0))

const bytesToBase64Url = (bytes: Uint8Array): string =>
  window
    .btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const decodeJwtPart = (part: string): Record<string, unknown> | undefined => {
  try {
    const decoded: unknown = JSON.parse(decodeBase64Url(part))
    return isRecord(decoded) ? decoded : undefined
  } catch {
    return undefined
  }
}

/** Payload of a compact JWT, or undefined when it cannot be decoded */
export const decodeJwtClaims = (
  jwt: string,
): Record<string, unknown> | undefined => {
  const parts = jwt.split('.')
  return parts.length === 3 ? decodeJwtPart(parts[1]) : undefined
}

interface SigningAlgorithm {
  kty: 'RSA' | 'EC'
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512'
  importParams: RsaHashedImportParams | EcKeyImportParams
  verifyParams: Algorithm | EcdsaParams
}

const rsa = (hash: SigningAlgorithm['hash']): SigningAlgorithm => ({
  kty: 'RSA',
  hash,
  importParams: { name: 'RSASSA-PKCS1-v1_5', hash },
  verifyParams: { name: 'RSASSA-PKCS1-v1_5' },
})

const ec = (
  namedCurve: string,
  hash: SigningAlgorithm['hash'],
): SigningAlgorithm => ({
  kty: 'EC',
  hash,
  importParams: { name: 'ECDSA', namedCurve },
  verifyParams: { name: 'ECDSA', hash },
})

/** JWS algorithms accepted for ID tokens; `none` and HMAC are deliberately absent */
const SIGNING_ALGORITHMS = new Map<string, SigningAlgorithm>([
  ['RS256', rsa('SHA-256')],
  ['RS384', rsa('SHA-384')],
  ['RS512', rsa('SHA-512')],
  ['ES256', ec('P-256', 'SHA-256')],
  ['ES384', ec('P-384', 'SHA-384')],
])

const toJsonWebKey = (key: SigningKey): JsonWebKey => {
  const read = (name: string): string | undefined => {
    const value = key[name]
    return typeof value === 'string' ? value : undefined
  }
  return {
    kty: read('kty'),
    n: read('n'),
    e: read('e'),
    crv: read('crv'),
    x: read('x'),
    y: read('y'),
  }
}

/**
 * Verify the ID token signature against the provider's published keys, and
 * that the access token is the one the ID token was issued with (`at_hash`).
 * Without this, a response injected into the callback could carry any token.
 *
 * @throws Error when the token is not signed by the provider or does not
 *   match the access token
 */
export async function verifyIdToken({
  idToken,
  accessToken,
  keys,
  subtle,
}: {
  idToken: string
  accessToken: string
  keys: readonly SigningKey[]
  subtle: SubtleCrypto
}): Promise<void> {
  const [headerPart, payloadPart, signaturePart] = idToken.split('.')
  const header = decodeJwtPart(headerPart ?? '')
  const algorithm =
    typeof header?.alg === 'string'
      ? SIGNING_ALGORITHMS.get(header.alg)
      : undefined
  if (header === undefined || algorithm === undefined) {
    throw new Error('Unsupported ID token signing algorithm')
  }
  const kid = typeof header.kid === 'string' ? header.kid : undefined
  const candidates = keys.filter(
    (key) =>
      key.kty === algorithm.kty &&
      (kid === undefined || key.kid === kid) &&
      (key.use === undefined || key.use === 'sig'),
  )
  const signature = binaryToBytes(decodeBase64UrlToBinary(signaturePart ?? ''))
  const signingInput = binaryToBytes(`${headerPart}.${payloadPart}`)
  let isVerified = false
  for (const key of candidates) {
    const cryptoKey = await subtle.importKey(
      'jwk',
      toJsonWebKey(key),
      algorithm.importParams,
      false,
      ['verify'],
    )
    if (
      await subtle.verify(
        algorithm.verifyParams,
        cryptoKey,
        signature,
        signingInput,
      )
    ) {
      isVerified = true
      break
    }
  }
  if (!isVerified) {
    throw new Error('ID token signature is invalid')
  }

  /** OIDC Core 3.2.2.10: `at_hash` is required when the response carries an access token */
  const atHash = decodeJwtPart(payloadPart ?? '')?.at_hash
  if (typeof atHash !== 'string') {
    throw new Error('ID token has no at_hash for the access token')
  }
  const digest = new Uint8Array(
    await subtle.digest(algorithm.hash, binaryToBytes(accessToken)),
  )
  if (bytesToBase64Url(digest.slice(0, digest.length / 2)) !== atHash) {
    throw new Error('Access token does not match the ID token')
  }
}

export interface IdTokenExpectations {
  issuer: string
  clientId: string
  nonce: string
  nowInSeconds: number
}

/**
 * Check the ID token claims that bind it to this request and client.
 *
 * @throws Error naming the first claim that does not match
 */
export const validateIdTokenClaims = (
  claims: Record<string, unknown>,
  expected: IdTokenExpectations,
): IdTokenClaims => {
  const { iss, sub, aud, azp, exp, iat, nonce } = claims
  if (typeof sub !== 'string' || sub === '') {
    throw new Error('ID token has no subject')
  }
  if (iss !== expected.issuer) {
    throw new Error('ID token issuer does not match the provider')
  }
  const audiences = typeof aud === 'string' ? [aud] : aud
  if (
    !Array.isArray(audiences) ||
    !audiences.some((audience) => audience === expected.clientId)
  ) {
    throw new Error('ID token audience does not include the client')
  }
  /** OIDC Core 3.1.3.7: with several audiences the token must name this client as `azp` */
  if (
    (audiences.length > 1 || azp !== undefined) &&
    azp !== expected.clientId
  ) {
    throw new Error('ID token authorized party is not the client')
  }
  if (nonce !== expected.nonce) {
    throw new Error('ID token nonce does not match the request')
  }
  if (
    typeof exp !== 'number' ||
    exp + CLOCK_SKEW_SECONDS < expected.nowInSeconds
  ) {
    throw new Error('ID token has expired')
  }
  if (typeof iat !== 'number') {
    throw new Error('ID token has no issue time')
  }
  return {
    ...claims,
    iss: expected.issuer,
    sub,
    aud: typeof aud === 'string' ? aud : audiences.map(String),
    exp,
    iat,
  }
}

/** Stored like an oidc-client-ts `State` so the library's stale-state sweep applies */
interface PendingRequest {
  id: string
  created: number
  request_type: string
  nonce: string
  data?: unknown
}

const parsePendingRequest = (raw: string): PendingRequest | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      typeof parsed.id !== 'string' ||
      typeof parsed.nonce !== 'string'
    ) {
      return undefined
    }
    return {
      id: parsed.id,
      nonce: parsed.nonce,
      created: typeof parsed.created === 'number' ? parsed.created : 0,
      request_type:
        typeof parsed.request_type === 'string' ? parsed.request_type : '',
      data: parsed.data,
    }
  } catch {
    return undefined
  }
}

const nowInSeconds = (): number => Math.floor(Date.now() / 1000)

/**
 * Load `url` in a hidden frame and resolve with the URL the provider redirects
 * back to. The callback lands on Slim's own origin, so its URL is readable;
 * pages on the provider's origin throw on access and are skipped.
 */
export const loadInHiddenFrame = (
  url: string,
  timeoutMs: number,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.visibility = 'hidden'
    frame.style.position = 'fixed'
    frame.style.left = '-1000px'
    frame.style.top = '0'
    frame.width = '0'
    frame.height = '0'

    const listeners = new AbortController()
    let timer: number | undefined
    const cleanup = (): void => {
      window.clearTimeout(timer)
      listeners.abort()
      frame.remove()
    }
    const handleLoad = (): void => {
      let href: string | undefined
      try {
        href = frame.contentWindow?.location.href
      } catch {
        return
      }
      if (href === undefined || href === 'about:blank') {
        return
      }
      if (!isOidcAuthorizeCallbackUrl(new URL(href))) {
        return
      }
      cleanup()
      resolve(href)
    }
    timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('silent renew timed out'))
    }, timeoutMs)

    frame.addEventListener('load', handleLoad, { signal: listeners.signal })
    document.body.appendChild(frame)
    frame.src = url
  })

/** The part of oidc-client-ts's `UserManager` the implicit grant relies on */
export interface ImplicitGrantHost {
  settings: Pick<
    UserManagerSettingsStore,
    | 'client_id'
    | 'scope'
    | 'redirect_uri'
    | 'silent_redirect_uri'
    | 'loadUserInfo'
    | 'includeIdTokenInSilentRenew'
    | 'validateSubOnSilentRenew'
  >
  metadataService: Pick<
    MetadataService,
    | 'getAuthorizationEndpoint'
    | 'getIssuer'
    | 'getUserInfoEndpoint'
    | 'getSigningKeys'
  >
  events: Pick<UserManagerEvents, 'load'>
  getUser: () => Promise<User | null>
  storeUser: (user: User | null) => Promise<void>
}

export interface ImplicitGrantOptions {
  loadFrame?: (url: string, timeoutMs: number) => Promise<string>
  /** Undefined outside secure contexts, where sign-in cannot be verified */
  subtle?: SubtleCrypto
}

/**
 * Implicit grant for deployments whose identity provider client only allows it
 * (common for Google Cloud Healthcare setups). oidc-client-ts dropped the
 * implicit flow, so the authorize request, callback validation and silent
 * renew are done here, and the result is handed to the `UserManager` as a
 * regular `User` so storage, expiry events and sign-out stay in the library.
 */
export class ImplicitGrant {
  private readonly oidc: ImplicitGrantHost
  private readonly stateStore: StateStore
  private readonly loadFrame: (
    url: string,
    timeoutMs: number,
  ) => Promise<string>
  private readonly subtle: SubtleCrypto | undefined

  constructor(
    oidc: ImplicitGrantHost,
    stateStore: StateStore,
    options: ImplicitGrantOptions = {},
  ) {
    this.oidc = oidc
    this.stateStore = stateStore
    this.loadFrame = options.loadFrame ?? loadInHiddenFrame
    this.subtle = 'subtle' in options ? options.subtle : window.crypto?.subtle
  }

  /** Navigate to the provider; `data` comes back as `User.state` */
  async signinRedirect(data: unknown): Promise<void> {
    const url = await this.createAuthorizeUrl({
      data,
      requestType: REDIRECT_REQUEST_TYPE,
      redirectUri: this.oidc.settings.redirect_uri,
    })
    window.location.assign(url)
  }

  async signinRedirectCallback(url: string): Promise<User> {
    return await this.complete(
      parseImplicitCallback(url),
      REDIRECT_REQUEST_TYPE,
      undefined,
    )
  }

  /** Renew without user interaction (`prompt=none`) in a hidden frame */
  async signinSilent(): Promise<User> {
    const { settings } = this.oidc
    const current = await this.oidc.getUser()
    const url = await this.createAuthorizeUrl({
      data: undefined,
      requestType: SILENT_REQUEST_TYPE,
      redirectUri: settings.silent_redirect_uri,
      prompt: 'none',
      idTokenHint: settings.includeIdTokenInSilentRenew
        ? current?.id_token
        : undefined,
    })
    const callbackUrl = await this.loadFrame(url, SILENT_RENEW_TIMEOUT_MS)
    const expectedSubject = settings.validateSubOnSilentRenew
      ? current?.profile.sub
      : undefined
    return await this.complete(
      parseImplicitCallback(callbackUrl),
      SILENT_REQUEST_TYPE,
      expectedSubject,
    )
  }

  private async createAuthorizeUrl({
    data,
    requestType,
    redirectUri,
    prompt,
    idTokenHint,
  }: {
    data: unknown
    requestType: string
    redirectUri: string
    prompt?: string
    idTokenHint?: string
  }): Promise<string> {
    const authorizationEndpoint =
      await this.oidc.metadataService.getAuthorizationEndpoint()
    const request: PendingRequest = {
      id: generateUuid().replace(/-/g, ''),
      created: nowInSeconds(),
      request_type: requestType,
      nonce: generateUuid().replace(/-/g, ''),
      data,
    }
    await this.stateStore.set(request.id, JSON.stringify(request))
    return buildImplicitAuthorizeUrl({
      authorizationEndpoint,
      clientId: this.oidc.settings.client_id,
      redirectUri,
      scope: this.oidc.settings.scope,
      state: request.id,
      nonce: request.nonce,
      prompt,
      idTokenHint,
    })
  }

  private async complete(
    callback: ImplicitCallback,
    requestType: string,
    expectedSubject: string | undefined,
  ): Promise<User> {
    if (callback.state === null) {
      throw new Error('No state in response')
    }
    /** Removed before anything else so a response can be used only once */
    const raw = await this.stateStore.remove(callback.state)
    const pending = raw === null ? undefined : parsePendingRequest(raw)
    if (pending === undefined || pending.request_type !== requestType) {
      throw new Error('No matching state found in storage')
    }
    if (callback.error !== null) {
      throw new Error(callback.errorDescription ?? callback.error)
    }
    if (callback.accessToken === null || callback.idToken === null) {
      throw new Error('Response is missing the access token or ID token')
    }
    const claims = decodeJwtClaims(callback.idToken)
    if (claims === undefined) {
      throw new Error('Malformed ID token')
    }
    if (this.subtle === undefined) {
      throw new Error(
        'ID tokens can only be verified in a secure context (HTTPS or localhost)',
      )
    }
    await verifyIdToken({
      idToken: callback.idToken,
      accessToken: callback.accessToken,
      keys: (await this.oidc.metadataService.getSigningKeys()) ?? [],
      subtle: this.subtle,
    })
    const now = nowInSeconds()
    const { settings } = this.oidc
    const idTokenClaims = validateIdTokenClaims(claims, {
      issuer: await this.oidc.metadataService.getIssuer(),
      clientId: settings.client_id,
      nonce: pending.nonce,
      nowInSeconds: now,
    })
    if (
      expectedSubject !== undefined &&
      idTokenClaims.sub !== expectedSubject
    ) {
      throw new Error('Silent renew returned a different user')
    }
    const profile = settings.loadUserInfo
      ? await this.mergeUserInfo(idTokenClaims, callback.accessToken)
      : idTokenClaims
    const user = new User({
      access_token: callback.accessToken,
      token_type: callback.tokenType ?? 'Bearer',
      id_token: callback.idToken,
      scope: callback.scope ?? settings.scope,
      session_state: callback.sessionState,
      profile,
      expires_at:
        callback.expiresIn !== undefined ? now + callback.expiresIn : undefined,
      userState: pending.data,
    })
    await this.oidc.storeUser(user)
    await this.oidc.events.load(user)
    return user
  }

  /** Profile claims from the user info endpoint; the ID token claims on failure */
  private async mergeUserInfo(
    claims: IdTokenClaims,
    accessToken: string,
  ): Promise<IdTokenClaims> {
    try {
      const endpoint = await this.oidc.metadataService.getUserInfoEndpoint()
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        return claims
      }
      const info: unknown = await response.json()
      if (!isRecord(info) || info.sub !== claims.sub) {
        return claims
      }
      return {
        ...claims,
        ...info,
        iss: claims.iss,
        sub: claims.sub,
        aud: claims.aud,
        exp: claims.exp,
        iat: claims.iat,
      }
    } catch (error) {
      console.warn('could not load user info', error)
      return claims
    }
  }
}

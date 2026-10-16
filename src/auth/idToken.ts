import type { IdTokenClaims, SigningKey } from 'oidc-client-ts'

import type { IdTokenCrypto, SignatureScheme } from './idTokenCrypto'
import { jwkFromX5c } from './x509'

/** Leeway for ID token expiry, as in oidc-client 1.x */
const CLOCK_SKEW_SECONDS = 300

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
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/[=]+$/, '')

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

/** JWS algorithms accepted for ID tokens; `none` and HMAC are deliberately absent */
const SIGNING_ALGORITHMS = new Map<string, SignatureScheme>([
  ['RS256', { kty: 'RSA', hash: 'SHA-256' }],
  ['RS384', { kty: 'RSA', hash: 'SHA-384' }],
  ['RS512', { kty: 'RSA', hash: 'SHA-512' }],
  ['PS256', { kty: 'RSA', hash: 'SHA-256', padding: 'PSS' }],
  ['PS384', { kty: 'RSA', hash: 'SHA-384', padding: 'PSS' }],
  ['PS512', { kty: 'RSA', hash: 'SHA-512', padding: 'PSS' }],
  ['ES256', { kty: 'EC', namedCurve: 'P-256', hash: 'SHA-256' }],
  ['ES384', { kty: 'EC', namedCurve: 'P-384', hash: 'SHA-384' }],
  ['ES512', { kty: 'EC', namedCurve: 'P-521', hash: 'SHA-512' }],
])

export const toJsonWebKey = (key: SigningKey): JsonWebKey | undefined => {
  const read = (name: string): string | undefined => {
    const value = key[name]
    return typeof value === 'string' ? value : undefined
  }
  const kty = read('kty')
  const n = read('n')
  const e = read('e')
  const crv = read('crv')
  const x = read('x')
  const y = read('y')
  if (kty === 'RSA' && n !== undefined && e !== undefined) {
    return { kty, n, e }
  }
  if (kty === 'EC' && crv !== undefined && x !== undefined && y !== undefined) {
    return { kty, crv, x, y }
  }
  /** Keys published only as x5c: decode the leaf cert, else keep x5c for Web Crypto */
  const x5c = key.x5c
  if (!Array.isArray(x5c) || typeof x5c[0] !== 'string' || x5c[0] === '') {
    return undefined
  }
  return (
    jwkFromX5c(x5c[0]) ?? ({ kty: kty ?? 'RSA', x5c: [x5c[0]] } as JsonWebKey)
  )
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
  crypto,
}: {
  idToken: string
  accessToken: string
  keys: readonly SigningKey[]
  crypto: IdTokenCrypto
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
      (key.kty === undefined || key.kty === algorithm.kty) &&
      (kid === undefined || key.kid === kid) &&
      (key.use === undefined || key.use === 'sig'),
  )
  const signature = binaryToBytes(decodeBase64UrlToBinary(signaturePart ?? ''))
  const signingInput = binaryToBytes(`${headerPart}.${payloadPart}`)
  let isVerified = false
  for (const key of candidates) {
    const jwk = toJsonWebKey(key)
    if (jwk === undefined) continue
    if (await crypto.verify(algorithm, jwk, signature, signingInput)) {
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
  const digest = await crypto.digest(algorithm.hash, binaryToBytes(accessToken))
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
  if (iat > expected.nowInSeconds + CLOCK_SKEW_SECONDS) {
    throw new Error('ID token issue time is in the future')
  }
  const nbf = claims.nbf
  if (
    typeof nbf === 'number' &&
    expected.nowInSeconds + CLOCK_SKEW_SECONDS < nbf
  ) {
    throw new Error('ID token is not yet valid')
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

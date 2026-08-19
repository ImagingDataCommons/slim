/**
 * Per-origin record of whether Slim may attach the user's OIDC access token to
 * DICOMweb requests.
 *
 * Slim never sends the token to a server preemptively. It starts anonymous —
 * which keeps requests CORS-simple, since "Authorization" is not a safelisted
 * request header and would force an OPTIONS preflight — and only escalates when
 * a server actually answers 401/403. Escalation for an origin that did not come
 * from the deployed configuration requires explicit user consent, because a
 * hostile endpoint could otherwise harvest a live cloud credential simply by
 * replying 401.
 *
 * Decisions are remembered per origin so the question is asked at most once.
 * Grants expire, denials do not: forgetting a grant costs one extra prompt,
 * whereas forgetting a denial silently widens what the token is disclosed to.
 */

export type AuthorizationDecision = 'granted' | 'denied'

const STORAGE_KEY = 'slim_authorization_policy'

/**
 * How long consent to disclose the token to an origin stays valid.
 *
 * Consent is not itself a credential, but it is durable authority: on a shared
 * computer, a decision left behind by one user would silently apply to the next
 * user's token. Thirty days keeps the prompt rare for a server someone uses
 * regularly while bounding how long a stale approval can act on someone else's
 * behalf.
 */
const GRANT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

interface StoredDecision {
  decision: AuthorizationDecision
  /** Epoch milliseconds after which the decision is discarded; grants only. */
  expiresAt?: number
}

type PolicyRecord = Record<string, StoredDecision>

/**
 * Resolve the origin of a DICOMweb service URL. Relative URLs (`servers[].path`
 * configurations) resolve against the Slim origin, which is what we want: those
 * are same-origin by construction.
 *
 * @param url - Absolute or relative DICOMweb service URL
 * @returns The origin, or undefined if the URL cannot be parsed
 */
export const getOrigin = (url: string): string | undefined => {
  try {
    return new URL(url, window.location.href).origin
  } catch {
    return undefined
  }
}

/**
 * Whether an origin can receive a bearer token without exposing it in transit.
 *
 * Mirrors the browser's own notion of a secure context: TLS, or a loopback host
 * where there is no network to intercept. A page served over HTTPS cannot reach
 * an `http://` endpoint anyway — mixed content blocks it — so this matters for
 * Slim deployments served over plain HTTP, typically on an intranet, where the
 * browser would otherwise let a token cross the wire in the clear.
 *
 * @param origin - Origin of the DICOMweb server
 * @returns Whether credentials may be disclosed to it
 */
export const isSecureOrigin = (origin: string): boolean => {
  try {
    const { protocol, hostname } = new URL(origin)
    if (protocol === 'https:') {
      return true
    }
    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '::1'
    )
  } catch {
    return false
  }
}

const readPolicy = (): PolicyRecord => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    return parsed as PolicyRecord
  } catch {
    /** Private browsing or corrupted entry: fall back to asking again. */
    return {}
  }
}

/**
 * Look up a previously recorded decision for an origin.
 *
 * @param origin - Origin of the DICOMweb server
 * @param now - Current time in epoch milliseconds, injectable for tests
 * @returns The remembered decision, or undefined if unknown or expired
 */
export const readAuthorizationDecision = (
  origin: string,
  now: number = Date.now(),
): AuthorizationDecision | undefined => {
  const entry = readPolicy()[origin]
  if (entry === undefined || entry === null) {
    return undefined
  }
  const { decision, expiresAt } = entry
  if (decision !== 'granted' && decision !== 'denied') {
    return undefined
  }
  if (expiresAt !== undefined && now >= expiresAt) {
    return undefined
  }
  return decision
}

/**
 * Remember a decision for an origin so the user is not asked again. Grants are
 * stamped with an expiry; denials are kept indefinitely.
 *
 * @param origin - Origin of the DICOMweb server
 * @param decision - Whether the token may be sent to that origin
 * @param now - Current time in epoch milliseconds, injectable for tests
 */
export const writeAuthorizationDecision = (
  origin: string,
  decision: AuthorizationDecision,
  now: number = Date.now(),
): void => {
  try {
    const policy = readPolicy()
    policy[origin] =
      decision === 'granted'
        ? { decision, expiresAt: now + GRANT_LIFETIME_MS }
        : { decision }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(policy))
  } catch {
    /** Non-persistent storage is not fatal; the user is simply asked again. */
  }
}

/**
 * Forget every recorded decision, so every server is negotiated afresh.
 *
 * @returns Nothing
 */
export const clearAuthorizationDecisions = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /** Nothing to clear if storage is unavailable. */
  }
}

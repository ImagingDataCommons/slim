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
 * Decisions are remembered per origin so the question is asked at most once per
 * browser.
 */

export type AuthorizationDecision = 'granted' | 'denied'

const STORAGE_KEY = 'slim_authorization_policy'

type PolicyRecord = Record<string, AuthorizationDecision>

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
 * @returns The remembered decision, or undefined if the origin is unknown
 */
export const readAuthorizationDecision = (
  origin: string,
): AuthorizationDecision | undefined => {
  const decision = readPolicy()[origin]
  return decision === 'granted' || decision === 'denied' ? decision : undefined
}

/**
 * Remember a decision for an origin so the user is not asked again.
 *
 * @param origin - Origin of the DICOMweb server
 * @param decision - Whether the token may be sent to that origin
 */
export const writeAuthorizationDecision = (
  origin: string,
  decision: AuthorizationDecision,
): void => {
  try {
    const policy = readPolicy()
    policy[origin] = decision
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(policy))
  } catch {
    /** Non-persistent storage is not fatal; the user is simply asked again. */
  }
}

/**
 * Forget every recorded decision. Exposed for tests and for a future "reset
 * server permissions" affordance.
 */
export const clearAuthorizationDecisions = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /** Nothing to clear if storage is unavailable. */
  }
}

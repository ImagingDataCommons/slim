import type { OidcSettings } from '../AppConfig'
import { clearAuthorizationDecisions } from '../utils/authPolicy'

/** localStorage key for the OIDC config entered in server selection */
export const OIDC_CONFIG_STORAGE_KEY = 'slim_oidc_config'

/** URL query parameter that discards the cached OIDC config, e.g. `?resetOidc` */
export const OIDC_RESET_PARAM = 'resetOidc'

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== ''

/**
 * Quote unquoted keys so JavaScript object notation parses as JSON,
 * e.g. `{ authority: "value" }` -> `{ "authority": "value" }`.
 */
const normalizeToJson = (input: string): string =>
  input.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')

/**
 * Strict JSON is parsed as-is, because quoting keys would also rewrite string
 * values that contain `,word:`.
 */
const parseObjectNotation = (input: string): unknown => {
  try {
    return JSON.parse(input)
  } catch {
    return JSON.parse(normalizeToJson(input))
  }
}

/**
 * Parse an OIDC config string (JSON or JavaScript object notation).
 * Returns undefined when empty, malformed, or missing authority, clientId,
 * or scope.
 */
export const parseOidcConfig = (
  input: string | null | undefined,
): OidcSettings | undefined => {
  if (input == null || input.trim() === '') {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = parseObjectNotation(input.trim())
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined
  }
  const { authority, clientId, scope, ...optional } = parsed as Record<
    string,
    unknown
  >
  if (
    !isNonEmptyString(authority) ||
    !isNonEmptyString(clientId) ||
    !isNonEmptyString(scope)
  ) {
    return undefined
  }
  return {
    authority,
    clientId,
    scope,
    grantType: optional.grantType as OidcSettings['grantType'],
    authorizationEndpoint: optional.authorizationEndpoint as string | undefined,
    endSessionEndpoint: optional.endSessionEndpoint as string | undefined,
  }
}

/** An empty config is valid because OIDC is optional */
export const isValidOidcConfig = (input: string | null | undefined): boolean =>
  input == null || input.trim() === '' || parseOidcConfig(input) != null

/**
 * Settings to apply when server selection is confirmed. The field is
 * prefilled from the cache, so an unchanged entry returns undefined. Emptying
 * the field returns null: the cached config is dropped in favor of the
 * deployment one.
 */
export const getOidcConfigToApply = (
  input: string,
  cachedInput: string,
): OidcSettings | null | undefined => {
  const trimmedInput = input.trim()
  if (trimmedInput === cachedInput) {
    return undefined
  }
  if (trimmedInput === '') {
    return null
  }
  return parseOidcConfig(trimmedInput)
}

/** The raw cached entry, or an empty string when there is none */
export const readCachedOidcConfigInput = (): string =>
  window.localStorage.getItem(OIDC_CONFIG_STORAGE_KEY) ?? ''

export const readCachedOidcConfig = (): OidcSettings | undefined =>
  parseOidcConfig(readCachedOidcConfigInput())

/**
 * Token grants are recorded per origin without the issuer, so they are
 * forgotten whenever the identity provider changes. Otherwise a token from the
 * new provider would reach origins that were only approved for the old one.
 */
const replaceCachedOidcConfigInput = (input: string): void => {
  if (input === readCachedOidcConfigInput()) {
    return
  }
  clearAuthorizationDecisions()
  if (input === '') {
    window.localStorage.removeItem(OIDC_CONFIG_STORAGE_KEY)
  } else {
    window.localStorage.setItem(OIDC_CONFIG_STORAGE_KEY, input)
  }
}

/** Cache a valid config entry, or drop the cache when the entry is not one */
export const cacheOidcConfigInput = (input: string): void => {
  const trimmedInput = input.trim()
  replaceCachedOidcConfigInput(
    parseOidcConfig(trimmedInput) != null ? trimmedInput : '',
  )
}

export const clearCachedOidcConfig = (): void => {
  replaceCachedOidcConfigInput('')
}

/**
 * Clear the cached config when the URL has `?resetOidc`, then drop the
 * parameter from the URL. This is the way out when a cached config sends the
 * user straight to an identity provider error page on every load.
 */
export const resetCachedOidcConfigFromUrl = (): boolean => {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(OIDC_RESET_PARAM)) {
    return false
  }
  clearCachedOidcConfig()
  url.searchParams.delete(OIDC_RESET_PARAM)
  window.history.replaceState(window.history.state, '', url.toString())
  return true
}

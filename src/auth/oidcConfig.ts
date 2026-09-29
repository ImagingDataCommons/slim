import type { OidcSettings } from '../AppConfig'

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
  try {
    const parsed = JSON.parse(normalizeToJson(input.trim()))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      isNonEmptyString(parsed.authority) &&
      isNonEmptyString(parsed.clientId) &&
      isNonEmptyString(parsed.scope)
    ) {
      return {
        authority: parsed.authority,
        clientId: parsed.clientId,
        scope: parsed.scope,
        grantType: parsed.grantType,
        authorizationEndpoint: parsed.authorizationEndpoint,
        endSessionEndpoint: parsed.endSessionEndpoint,
      }
    }
  } catch {
    /** Invalid format */
  }
  return undefined
}

/** An empty config is valid because OIDC is optional */
export const isValidOidcConfig = (input: string | null | undefined): boolean =>
  input == null || input.trim() === '' || parseOidcConfig(input) != null

export const readCachedOidcConfig = (): OidcSettings | undefined =>
  parseOidcConfig(window.localStorage.getItem(OIDC_CONFIG_STORAGE_KEY))

export const clearCachedOidcConfig = (): void => {
  window.localStorage.removeItem(OIDC_CONFIG_STORAGE_KEY)
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

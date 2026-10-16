import type { User as UserData } from 'oidc-client-ts'

import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'
import type { User } from '.'

/** Query and fragment parameters an authorize redirect may append */
const AUTH_RESPONSE_PARAMS = [
  'code',
  'state',
  'session_state',
  'iss',
  'id_token',
  'access_token',
  'token_type',
  'expires_in',
  'scope',
  'error',
  'error_description',
]

export const createUser = (userData: UserData | null): User => {
  const profile = userData?.profile
  if (profile === undefined) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.AUTH,
      new CustomError(
        errorTypes.AUTHENTICATION,
        'Failed to obtain user profile.',
      ),
    )
    return { name: undefined, email: undefined }
  }
  if (profile.name === undefined || profile.email === undefined) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.AUTH,
      new CustomError(
        errorTypes.AUTHENTICATION,
        'Failed to obtain user "name" and "email".',
      ),
    )
    return { name: undefined, email: undefined }
  }
  return { name: profile.name, email: profile.email }
}

/** Full HTTP Authorization header value, e.g. "Bearer …" */
export const authorizationFromUser = (userData: UserData): string => {
  const tokenType = userData.token_type || 'Bearer'
  return `${tokenType} ${userData.access_token}`
}

/** Only allow same-origin relative paths (block open redirects). */
export const isSafeReturnUrl = (returnUrl: string): boolean => {
  if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return false
  }
  try {
    const parsed = new URL(returnUrl, window.location.origin)
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

/** Return URL carried through sign-in in the OIDC `state`, if it is safe */
export const readReturnUrl = (userData: UserData): string | undefined => {
  const { state } = userData
  let returnUrl: unknown
  if (typeof state === 'string') {
    returnUrl = state
  } else if (
    typeof state === 'object' &&
    state !== null &&
    'returnUrl' in state
  ) {
    returnUrl = state.returnUrl
  }
  if (typeof returnUrl !== 'string' || returnUrl === '') {
    return undefined
  }
  return isSafeReturnUrl(returnUrl) ? returnUrl : undefined
}

export const currentReturnUrl = (): string =>
  `${window.location.pathname}${window.location.search}`

/**
 * Drop authorize response parameters from the address bar so tokens are not
 * left in history and a reload does not replay the callback.
 */
export const clearAuthParamsFromUrl = (): void => {
  const url = new URL(window.location.href)
  for (const key of AUTH_RESPONSE_PARAMS) {
    url.searchParams.delete(key)
  }
  /** Implicit / hybrid responses put tokens in the hash fragment. */
  url.hash = ''
  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}`,
  )
}

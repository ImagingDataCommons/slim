export type SignInCallback = ({
  user,
  authorization,
  returnUrl,
}: {
  user: User
  authorization: string
  returnUrl?: string
}) => void

export type AuthorizationCallback = (authorization: string) => void

/** Outcome of signIn: redirected means the page is navigating to the IdP. */
export type SignInOutcome = 'completed' | 'redirected'

export interface User {
  name: string | undefined
  email: string | undefined
}

export interface AuthManager {
  signIn: ({
    onSignIn,
    returnUrl,
  }: {
    onSignIn?: SignInCallback
    returnUrl?: string
  }) => Promise<SignInOutcome>
  signOut: () => Promise<void>
  getAuthorization: () => Promise<string | undefined>
  getUser: () => Promise<User>
  /** Attempt silent token renewal; returns a full Authorization header value. */
  renewAuthorization: () => Promise<string | undefined>
  /** Subscribe to authorization updates (e.g. after silent renew). */
  onAuthorizationChange: (callback: AuthorizationCallback) => () => void
}

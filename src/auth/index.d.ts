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
  }) => Promise<void>
  signOut: () => Promise<void>
  getAuthorization: () => Promise<string | undefined>
  getUser: () => Promise<User>
  /** Attempt silent token renewal; returns a full Authorization header value. */
  renewAuthorization: () => Promise<string | undefined>
  /** Subscribe to authorization updates (e.g. after silent renew). */
  onAuthorizationChange: (callback: AuthorizationCallback) => () => void
}

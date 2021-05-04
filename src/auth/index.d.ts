export type SignInCallback = ({ user, accessToken }: {
  user: User,
  accessToken: string
}) => void

export interface User {
  name: string
  email: string
}

export interface AuthManager {
  signIn ({ onSignIn }: { onSignIn: SignInCallback }): Promise<void>
  signOut (): Promise<void>
  getAccessToken (): Promise<string>
  getUser (): Promise<User>
}

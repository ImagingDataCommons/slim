export type SignInCallback = ({ user, authorization }: {
  user: User
  authorization: string
}) => void

export interface User {
  name: string|undefined
  email: string|undefined
}

export interface AuthManager {
  signIn: ({ onSignIn }: { onSignIn: SignInCallback }) => Promise<void>
  signOut: () => Promise<void>
  getAuthorization: () => Promise<string|undefined>
  getUser: () => Promise<User>
}

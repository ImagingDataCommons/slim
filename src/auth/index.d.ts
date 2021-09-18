export type SignInCallback = ({ user, authorization }: {
  user: User
  authorization: string
}) => void

export interface User {
  name: string
  email: string
}

export interface AuthManager {
  signIn: ({ onSignIn }: { onSignIn: SignInCallback }) => Promise<void>
  signOut: () => Promise<void>
  getAuthorization: () => Promise<string>
  getUser: () => Promise<User>
}

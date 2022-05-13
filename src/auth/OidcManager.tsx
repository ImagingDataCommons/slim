import { UserManager, User as UserData } from 'oidc-client'

import { OidcSettings } from '../AppConfig'
import { isAuthorizationCodeInUrl } from '../utils/url'
import { User, AuthManager, SignInCallback } from './'

const createUser = (userData: UserData): User => {
  const profile = userData.profile
  if (profile !== undefined) {
    if (profile.name === undefined || profile.email === undefined) {
      throw Error('Failed to obtain user "name" and "email".')
    } else {
      return {
        name: profile.name,
        email: profile.email
      }
    }
  } else {
    throw Error('Failed to obtain user profile.')
  }
}

export default class OidcManager implements AuthManager {
  private readonly _oidc: UserManager

  constructor (baseUri: string, settings: OidcSettings) {
    let responseType = 'code'
    if (settings.grantType !== undefined) {
      if (settings.grantType === 'implicit') {
        responseType = 'id_token token'
      }
    }
    this._oidc = new UserManager({
      authority: settings.authority,
      client_id: settings.clientId,
      redirect_uri: baseUri,
      scope: settings.scope,
      response_type: responseType,
      loadUserInfo: true,
      automaticSilentRenew: true,
      revokeAccessTokenOnSignout: true
    })
  }

  /**
   * Sign-in to authenticate the user and obtain authorization.
   */
  signIn = async ({ onSignIn }: {
    onSignIn?: SignInCallback
  }): Promise<void> => {
    const handleSignIn = (userData: UserData) => {
      const user = createUser(userData)
      const authorization = `${userData.token_type} ${userData.access_token}`
      if (onSignIn != null) {
        console.info('handling sign-in using provided callback function')
        onSignIn({ user: user, authorization: authorization })
      } else {
        console.warn('no callback function was provided to handle sign-in')
      }
    }

    if (isAuthorizationCodeInUrl(window.location)) {
      /* Handle the callback from the authorization server: extract the code
       * from the callback URL, obtain user information and the access token
       * for the DICOMweb server.
       */
      console.info('obtaining authorization')
      const userData = await this._oidc.signinCallback()
      if (userData != null) {
        console.info('obtained user data: ', userData)
        handleSignIn(userData)
      }
    } else {
      /* Redirect to the authorization server to authenticate the user
       * and authorize the application to obtain user information and access
       * the DICOMweb server.
       */
      const userData = await this._oidc.getUser()
      if (userData === null || userData.expired) {
        console.info('authenticating user')
        await this._oidc.signinRedirect()
      } else {
        console.info('user has already been authenticated')
        handleSignIn(userData)
      }
    }
  }

  /**
   * Sign-out to revoke authorization.
   */
  signOut = async (): Promise<void> => {
    console.log('revoking authorization')
    return await this._oidc.removeUser()
  }

  /**
   * Get authorization. Requires prior sign-in.
   */
  getAuthorization = async (): Promise<string> => {
    return await this._oidc.getUser().then((userData) => {
      if (userData !== null) {
        return userData.access_token
      } else {
        throw Error('Failed to obtain access token.')
      }
    })
  }

  /**
   * Get user information. Requires prior sign-in.
   */
  getUser = async (): Promise<User> => {
    return await this._oidc.getUser().then((userData) => {
      if (userData === null) {
        throw Error('Failed to obtain user information.')
      }
      return createUser(userData)
    })
  }
}

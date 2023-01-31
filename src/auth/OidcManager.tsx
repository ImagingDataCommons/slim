import { UserManager, User as UserData } from 'oidc-client'

import { OidcSettings } from '../AppConfig'
import { isAuthorizationCodeInUrl } from '../utils/url'
import { User, AuthManager, SignInCallback } from './'
import NotificationMiddleware,
{ NotificationMiddlewareContext } from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'

const createUser = (userData: UserData | null): User => {
  let profile
  if (userData !== null) {
    profile = userData.profile
  }

  if (profile !== undefined) {
    if (profile.name === undefined || profile.email === undefined) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.AUTH,
        new CustomError(
          errorTypes.AUTHENTICATION,
          'Failed to obtain user "name" and "email".'
        )
      )
    } else {
      return {
        name: profile.name,
        email: profile.email
      }
    }
  } else {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.AUTH,
      new CustomError(
        errorTypes.AUTHENTICATION,
        'Failed to obtain user profile.'
      )
    )
  }
  return {
    name: undefined,
    email: undefined
  }
}

export default class OidcManager implements AuthManager {
  private _oidc: UserManager

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
      revokeAccessTokenOnSignout: true,
      post_logout_redirect_uri: `${baseUri}/logout`
    })
    if (settings.endSessionEndpoint != null) {
      /*
       * Unfortunately, the end session endpoint alone cannot be provided to
       * the construction of UserManager and the other metadata parameters
       * would need to be provided as well. However, configuring all of them
       * individually would not be desirable and they will be automatically
       * determined anyways. Therefore, we first construct an object, get the
       * metadata, update the metadata, and then reconstruct an object with the
       * updated metadata.
       */
      this._oidc.metadataService.getMetadata().then(metadata => {
        if (settings.endSessionEndpoint != null) {
          metadata.end_session_endpoint = settings.endSessionEndpoint
          this._oidc = new UserManager({
            authority: settings.authority,
            client_id: settings.clientId,
            redirect_uri: baseUri,
            scope: settings.scope,
            response_type: responseType,
            loadUserInfo: true,
            automaticSilentRenew: true,
            revokeAccessTokenOnSignout: true,
            post_logout_redirect_uri: `${baseUri}/logout`,
            metadata
          })
        }
      }).catch((error) => {
        console.error(
          'failed to get metadata from authorization server: ',
          error
        )
      })
    }
  }

  /**
   * Sign-in to authenticate the user and obtain authorization.
   */
  signIn = async ({ onSignIn }: {
    onSignIn?: SignInCallback
  }): Promise<void> => {
    const handleSignIn = (userData: UserData): void => {
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
    console.log('signing out user and revoking authorization')
    return await this._oidc.signoutRedirect()
  }

  /**
   * Get authorization. Requires prior sign-in.
   */
  getAuthorization = async (): Promise<string|undefined> => {
    return await this._oidc.getUser().then((userData) => {
      if (userData !== null) {
        return userData.access_token
      } else {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.AUTH,
          new CustomError(
            errorTypes.AUTHENTICATION,
            'Failed to obtain user profile.'
          )
        )
      }
    })
  }

  /**
   * Get user information. Requires prior sign-in.
   */
  getUser = async (): Promise<User> => {
    return await this._oidc.getUser().then((userData) => {
      if (userData === null) {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.AUTH,
          new CustomError(
            errorTypes.AUTHENTICATION,
            'Failed to obtain user information.'
          )
        )
      }
      return createUser(userData)
    })
  }
}

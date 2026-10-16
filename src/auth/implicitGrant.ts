import {
  type IdTokenClaims,
  type MetadataService,
  State,
  type StateStore,
  User,
  type UserManagerEvents,
  type UserManagerSettingsStore,
} from 'oidc-client-ts'
import { v4 as generateUuid } from 'uuid'
import {
  decodeJwtClaims,
  validateIdTokenClaims,
  verifyIdToken,
} from './idToken'
import { type IdTokenCrypto, loadIdTokenCrypto } from './idTokenCrypto'
import {
  buildImplicitAuthorizeUrl,
  type ImplicitCallback,
  parseImplicitCallback,
} from './implicitAuthorize'
import { loadInHiddenFrame } from './silentFrame'

export type { IdTokenExpectations } from './idToken'
export {
  decodeJwtClaims,
  toJsonWebKey,
  validateIdTokenClaims,
  verifyIdToken,
} from './idToken'
export type {
  ImplicitAuthorizeRequest,
  ImplicitCallback,
} from './implicitAuthorize'
export {
  buildImplicitAuthorizeUrl,
  IMPLICIT_RESPONSE_TYPE,
  parseImplicitCallback,
} from './implicitAuthorize'
export { loadInHiddenFrame } from './silentFrame'

/** Same as the oidc-client-ts default `silentRequestTimeoutInSeconds` */
const SILENT_RENEW_TIMEOUT_MS = 10_000

/** Same default as oidc-client-ts `staleStateAgeInSeconds` */
const STALE_STATE_AGE_SECONDS = 900

const REDIRECT_REQUEST_TYPE = 'si:r'
const SILENT_REQUEST_TYPE = 'si:s'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Stored like an oidc-client-ts `State` so the library's stale-state sweep applies */
interface PendingRequest {
  id: string
  created: number
  request_type: string
  nonce: string
  data?: unknown
}

const parsePendingRequest = (raw: string): PendingRequest | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      typeof parsed.id !== 'string' ||
      typeof parsed.nonce !== 'string'
    ) {
      return undefined
    }
    return {
      id: parsed.id,
      nonce: parsed.nonce,
      created: typeof parsed.created === 'number' ? parsed.created : 0,
      request_type:
        typeof parsed.request_type === 'string' ? parsed.request_type : '',
      data: parsed.data,
    }
  } catch {
    return undefined
  }
}

const nowInSeconds = (): number => Math.floor(Date.now() / 1000)

/** The part of oidc-client-ts's `UserManager` the implicit grant relies on */
export interface ImplicitGrantHost {
  settings: Pick<
    UserManagerSettingsStore,
    | 'client_id'
    | 'scope'
    | 'redirect_uri'
    | 'silent_redirect_uri'
    | 'loadUserInfo'
    | 'includeIdTokenInSilentRenew'
    | 'validateSubOnSilentRenew'
    | 'staleStateAgeInSeconds'
  >
  metadataService: Pick<
    MetadataService,
    | 'getAuthorizationEndpoint'
    | 'getIssuer'
    | 'getUserInfoEndpoint'
    | 'getSigningKeys'
  >
  events: Pick<UserManagerEvents, 'load'>
  getUser: () => Promise<User | null>
  storeUser: (user: User | null) => Promise<void>
}

export interface ImplicitGrantOptions {
  loadFrame?: (url: string, timeoutMs: number) => Promise<string>
  /** Defaults to Web Crypto, or a JavaScript fallback outside secure contexts */
  crypto?: IdTokenCrypto
}

/**
 * Implicit grant for deployments whose identity provider client only allows it
 * (common for Google Cloud Healthcare setups). oidc-client-ts dropped the
 * implicit flow, so the authorize request, callback validation and silent
 * renew are done here, and the result is handed to the `UserManager` as a
 * regular `User` so storage, expiry events and sign-out stay in the library.
 */
export class ImplicitGrant {
  private readonly oidc: ImplicitGrantHost
  private readonly stateStore: StateStore
  private readonly loadFrame: (
    url: string,
    timeoutMs: number,
  ) => Promise<string>
  private readonly crypto: IdTokenCrypto | undefined

  constructor(
    oidc: ImplicitGrantHost,
    stateStore: StateStore,
    options: ImplicitGrantOptions = {},
  ) {
    this.oidc = oidc
    this.stateStore = stateStore
    this.loadFrame = options.loadFrame ?? loadInHiddenFrame
    this.crypto = options.crypto
  }

  /** Navigate to the provider; `data` comes back as `User.state` */
  async signinRedirect(data: unknown): Promise<void> {
    const url = await this.createAuthorizeUrl({
      data,
      requestType: REDIRECT_REQUEST_TYPE,
      redirectUri: this.oidc.settings.redirect_uri,
    })
    window.location.assign(url)
  }

  async signinRedirectCallback(url: string): Promise<User> {
    return await this.complete(
      parseImplicitCallback(url),
      REDIRECT_REQUEST_TYPE,
    )
  }

  /** Renew without user interaction (`prompt=none`) in a hidden frame */
  async signinSilent(): Promise<User> {
    const { settings } = this.oidc
    const current = await this.oidc.getUser()
    const url = await this.createAuthorizeUrl({
      requestType: SILENT_REQUEST_TYPE,
      redirectUri: settings.silent_redirect_uri,
      prompt: 'none',
      idTokenHint: settings.includeIdTokenInSilentRenew
        ? current?.id_token
        : undefined,
    })
    const callbackUrl = await this.loadFrame(url, SILENT_RENEW_TIMEOUT_MS)
    const expectedSubject = settings.validateSubOnSilentRenew
      ? current?.profile.sub
      : undefined
    return await this.complete(
      parseImplicitCallback(callbackUrl),
      SILENT_REQUEST_TYPE,
      expectedSubject,
    )
  }

  private async createAuthorizeUrl({
    data,
    requestType,
    redirectUri,
    prompt,
    idTokenHint,
  }: {
    data?: unknown
    requestType: string
    redirectUri: string
    prompt?: string
    idTokenHint?: string
  }): Promise<string> {
    /** Drop abandoned pending requests (Google often has no end-session URL) */
    await State.clearStaleState(
      this.stateStore,
      this.oidc.settings.staleStateAgeInSeconds ?? STALE_STATE_AGE_SECONDS,
    )
    const authorizationEndpoint =
      await this.oidc.metadataService.getAuthorizationEndpoint()
    const request: PendingRequest = {
      id: generateUuid().replace(/-/g, ''),
      created: nowInSeconds(),
      request_type: requestType,
      nonce: generateUuid().replace(/-/g, ''),
      data,
    }
    await this.stateStore.set(request.id, JSON.stringify(request))
    return buildImplicitAuthorizeUrl({
      authorizationEndpoint,
      clientId: this.oidc.settings.client_id,
      redirectUri,
      scope: this.oidc.settings.scope,
      state: request.id,
      nonce: request.nonce,
      prompt,
      idTokenHint,
    })
  }

  private async complete(
    callback: ImplicitCallback,
    requestType: string,
    expectedSubject?: string,
  ): Promise<User> {
    if (callback.state === null) {
      throw new Error('No state in response')
    }
    /** Removed before anything else so a response can be used only once */
    const raw = await this.stateStore.remove(callback.state)
    const pending = raw === null ? undefined : parsePendingRequest(raw)
    if (pending === undefined || pending.request_type !== requestType) {
      throw new Error('No matching state found in storage')
    }
    if (callback.error !== null) {
      throw new Error(callback.errorDescription ?? callback.error)
    }
    if (callback.accessToken === null || callback.idToken === null) {
      throw new Error('Response is missing the access token or ID token')
    }
    const claims = decodeJwtClaims(callback.idToken)
    if (claims === undefined) {
      throw new Error('Malformed ID token')
    }
    await verifyIdToken({
      idToken: callback.idToken,
      accessToken: callback.accessToken,
      keys: (await this.oidc.metadataService.getSigningKeys()) ?? [],
      crypto: this.crypto ?? (await loadIdTokenCrypto()),
    })
    const now = nowInSeconds()
    const { settings } = this.oidc
    const idTokenClaims = validateIdTokenClaims(claims, {
      issuer: await this.oidc.metadataService.getIssuer(),
      clientId: settings.client_id,
      nonce: pending.nonce,
      nowInSeconds: now,
    })
    if (
      expectedSubject !== undefined &&
      idTokenClaims.sub !== expectedSubject
    ) {
      throw new Error('Silent renew returned a different user')
    }
    const profile = settings.loadUserInfo
      ? await this.mergeUserInfo(idTokenClaims, callback.accessToken)
      : idTokenClaims
    const user = new User({
      access_token: callback.accessToken,
      token_type: callback.tokenType ?? 'Bearer',
      id_token: callback.idToken,
      scope: callback.scope ?? settings.scope,
      session_state: callback.sessionState,
      profile,
      expires_at:
        callback.expiresIn !== undefined ? now + callback.expiresIn : undefined,
      userState: pending.data,
    })
    await this.oidc.storeUser(user)
    await this.oidc.events.load(user)
    return user
  }

  /** Profile claims from the user info endpoint; the ID token claims on failure */
  private async mergeUserInfo(
    claims: IdTokenClaims,
    accessToken: string,
  ): Promise<IdTokenClaims> {
    try {
      const endpoint = await this.oidc.metadataService.getUserInfoEndpoint()
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        return claims
      }
      const info: unknown = await response.json()
      if (!isRecord(info) || info.sub !== claims.sub) {
        return claims
      }
      return {
        ...claims,
        ...info,
        iss: claims.iss,
        sub: claims.sub,
        aud: claims.aud,
        exp: claims.exp,
        iat: claims.iat,
      }
    } catch (error) {
      console.warn('could not load user info', error)
      return claims
    }
  }
}

import { webcrypto } from 'node:crypto'
import {
  type AccessTokenCallback,
  type OidcMetadata,
  type SigningKey,
  type SigninRedirectArgs,
  User,
  type UserLoadedCallback,
  type UserManagerSettings,
  type UserProfile,
} from 'oidc-client-ts'

import type { OidcUserManager } from '../OidcManager'

export const ISSUER = 'https://idp.example.com'
export const CLIENT_ID = 'slim'

export interface FakeUserManager extends OidcUserManager {
  /** Settings the manager was created with */
  readonly createdWith: UserManagerSettings
  readonly userLoadedListeners: UserLoadedCallback[]
  readonly tokenExpiringListeners: AccessTokenCallback[]
  stored: User | null
  getUser: jest.Mock<Promise<User | null>, []>
  storeUser: jest.Mock<Promise<void>, [User | null]>
  signinRedirect: jest.Mock<Promise<void>, [SigninRedirectArgs?]>
  signinRedirectCallback: jest.Mock<Promise<User>, [string?]>
  signinSilent: jest.Mock<Promise<User | null>, []>
  signoutRedirect: jest.Mock<Promise<void>, []>
  removeUser: jest.Mock<Promise<void>, []>
  revokeTokens: jest.Mock<Promise<void>, []>
}

export function createFakeUserManager(
  settings: UserManagerSettings,
  metadata: Partial<OidcMetadata> = {},
  signingKeys: SigningKey[] = [],
): FakeUserManager {
  const resolvedMetadata: Partial<OidcMetadata> = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    userinfo_endpoint: `${ISSUER}/userinfo`,
    ...metadata,
    ...settings.metadataSeed,
  }
  const userLoadedListeners: UserLoadedCallback[] = []
  const tokenExpiringListeners: AccessTokenCallback[] = []

  const fake: FakeUserManager = {
    createdWith: settings,
    userLoadedListeners,
    tokenExpiringListeners,
    stored: null,
    settings: {
      client_id: settings.client_id,
      scope: settings.scope ?? 'openid',
      redirect_uri: settings.redirect_uri,
      silent_redirect_uri:
        settings.silent_redirect_uri ?? settings.redirect_uri,
      loadUserInfo: settings.loadUserInfo ?? false,
      includeIdTokenInSilentRenew:
        settings.includeIdTokenInSilentRenew ?? false,
      validateSubOnSilentRenew: settings.validateSubOnSilentRenew ?? true,
    },
    metadataService: {
      getMetadata: () => Promise.resolve(resolvedMetadata),
      getAuthorizationEndpoint: () =>
        Promise.resolve(resolvedMetadata.authorization_endpoint ?? ''),
      getIssuer: () => Promise.resolve(resolvedMetadata.issuer ?? ''),
      getUserInfoEndpoint: () =>
        Promise.resolve(resolvedMetadata.userinfo_endpoint ?? ''),
      getSigningKeys: () => Promise.resolve(signingKeys),
    },
    events: {
      load: async (user: User): Promise<void> => {
        for (const listener of userLoadedListeners) {
          await listener(user)
        }
      },
      addUserLoaded: (callback: UserLoadedCallback) => {
        userLoadedListeners.push(callback)
        return () => {}
      },
      addAccessTokenExpiring: (callback: AccessTokenCallback) => {
        tokenExpiringListeners.push(callback)
        return () => {}
      },
    },
    getUser: jest.fn(() => Promise.resolve(fake.stored)),
    storeUser: jest.fn((user: User | null) => {
      fake.stored = user
      return Promise.resolve()
    }),
    signinRedirect: jest.fn(() => Promise.resolve()),
    signinRedirectCallback: jest.fn(() => Promise.resolve(makeUser())),
    signinSilent: jest.fn(() => Promise.resolve(makeUser())),
    signoutRedirect: jest.fn(() => Promise.resolve()),
    removeUser: jest.fn(() => {
      fake.stored = null
      return Promise.resolve()
    }),
    revokeTokens: jest.fn(() => Promise.resolve()),
  }
  return fake
}

const nowInSeconds = (): number => Math.floor(Date.now() / 1000)

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    iss: ISSUER,
    sub: 'user-1',
    aud: CLIENT_ID,
    exp: nowInSeconds() + 3600,
    iat: nowInSeconds(),
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    ...overrides,
  }
}

export function makeUser({
  accessToken = 'access-token',
  profile = makeProfile(),
  state,
  expiresAt = nowInSeconds() + 3600,
}: {
  accessToken?: string
  profile?: UserProfile
  state?: unknown
  expiresAt?: number
} = {}): User {
  return new User({
    access_token: accessToken,
    token_type: 'Bearer',
    id_token: 'id-token',
    profile,
    expires_at: expiresAt,
    userState: state,
  })
}

/** UTF-8 as a binary string, since jsdom has no `TextEncoder` */
const toUtf8Binary = (value: string): string =>
  encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )

const binaryToBase64Url = (binary: string): string =>
  window.btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

export const encodeBase64Url = (value: string): string =>
  binaryToBase64Url(toUtf8Binary(value))

const bytesToBase64Url = (bytes: ArrayBuffer): string =>
  binaryToBase64Url(String.fromCharCode(...new Uint8Array(bytes)))

const toBytes = (binary: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(binary, (char) => char.charCodeAt(0))

/** Unsigned compact JWT carrying `claims` */
export function makeJwt(
  claims: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'none', typ: 'JWT' },
): string {
  return `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(claims),
  )}.signature`
}

/** jsdom has no Web Crypto, so expose Node's where browsers do */
if (window.crypto?.subtle === undefined) {
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: webcrypto,
  })
}

export const subtle: SubtleCrypto = window.crypto.subtle

export interface IdTokenSigner {
  /** Public key as published in the provider's JWKS */
  jwk: SigningKey
  sign: (claims: Record<string, unknown>) => Promise<string>
  atHash: (accessToken: string) => Promise<string>
}

/** RS256 signer standing in for the identity provider */
export async function createIdTokenSigner(
  kid = 'key-1',
): Promise<IdTokenSigner> {
  const { publicKey, privateKey } = await subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const exported = await subtle.exportKey('jwk', publicKey)
  return {
    jwk: {
      kty: 'RSA',
      n: exported.n ?? '',
      e: exported.e ?? '',
      kid,
      use: 'sig',
      alg: 'RS256',
    },
    sign: async (claims) => {
      const signingInput = `${encodeBase64Url(
        JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }),
      )}.${encodeBase64Url(JSON.stringify(claims))}`
      const signature = await subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        toBytes(signingInput),
      )
      return `${signingInput}.${bytesToBase64Url(signature)}`
    },
    atHash: async (accessToken) => {
      const digest = await subtle.digest('SHA-256', toBytes(accessToken))
      return bytesToBase64Url(digest.slice(0, digest.byteLength / 2))
    },
  }
}

export interface LocationStub {
  assign: jest.Mock<void, [string]>
  restore: () => void
}

/** Replace `window.location` so navigation can be observed */
export function stubLocation(url: string): LocationStub {
  const original = window.location
  const parsed = new URL(url)
  const assign = jest.fn<void, [string]>()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: parsed.href,
      origin: parsed.origin,
      protocol: parsed.protocol,
      host: parsed.host,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      assign,
      replace: jest.fn(),
      reload: jest.fn(),
    },
  })
  return {
    assign,
    restore: () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: original,
      })
    },
  }
}

import { InMemoryWebStorage, type UserManagerSettings } from 'oidc-client-ts'
import type { Mock } from 'vitest'

import {
  buildImplicitAuthorizeUrl,
  decodeJwtClaims,
  ImplicitGrant,
  parseImplicitCallback,
  validateIdTokenClaims,
  verifyIdToken,
} from '../implicitGrant'
import { SafeStateStore } from '../oidcStore'
import {
  CLIENT_ID,
  createFakeUserManager,
  createIdTokenSigner,
  type FakeUserManager,
  type IdTokenSigner,
  ISSUER,
  makeJwt,
  makeProfile,
  makeUser,
  stubLocation,
  subtle,
} from '../testing/fakeUserManager'

const APP_URI = 'https://slim.example.com/'
const NOW = 1_700_000_000

let signer: IdTokenSigner

beforeAll(async () => {
  signer = await createIdTokenSigner()
})

describe('buildImplicitAuthorizeUrl', () => {
  it('requests an ID token and access token in one response', () => {
    const url = new URL(
      buildImplicitAuthorizeUrl({
        authorizationEndpoint: `${ISSUER}/authorize?hd=example.com`,
        clientId: CLIENT_ID,
        redirectUri: APP_URI,
        scope: 'openid email',
        state: 's1',
        nonce: 'n1',
      }),
    )
    expect(url.origin + url.pathname).toBe(`${ISSUER}/authorize`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      hd: 'example.com',
      client_id: CLIENT_ID,
      redirect_uri: APP_URI,
      response_type: 'id_token token',
      scope: 'openid email',
      state: 's1',
      nonce: 'n1',
    })
  })

  it('adds prompt and id_token_hint for silent requests', () => {
    const url = new URL(
      buildImplicitAuthorizeUrl({
        authorizationEndpoint: `${ISSUER}/authorize`,
        clientId: CLIENT_ID,
        redirectUri: APP_URI,
        scope: 'openid',
        state: 's1',
        nonce: 'n1',
        prompt: 'none',
        idTokenHint: 'hint',
      }),
    )
    expect(url.searchParams.get('prompt')).toBe('none')
    expect(url.searchParams.get('id_token_hint')).toBe('hint')
  })
})

describe('parseImplicitCallback', () => {
  it('reads tokens from the fragment', () => {
    expect(
      parseImplicitCallback(
        `${APP_URI}#access_token=at&token_type=Bearer&expires_in=3599&id_token=it&state=s1&scope=openid`,
      ),
    ).toEqual({
      state: 's1',
      accessToken: 'at',
      tokenType: 'Bearer',
      expiresIn: 3599,
      idToken: 'it',
      scope: 'openid',
      sessionState: null,
      error: null,
      errorDescription: null,
    })
  })

  it('reads errors reported in the query', () => {
    const callback = parseImplicitCallback(
      `${APP_URI}?error=login_required&state=s1`,
    )
    expect(callback.error).toBe('login_required')
    expect(callback.state).toBe('s1')
    expect(callback.expiresIn).toBeUndefined()
  })
})

describe('decodeJwtClaims', () => {
  it('decodes the payload, including non-ASCII text', () => {
    expect(decodeJwtClaims(makeJwt({ sub: 'u', name: 'José' }))).toEqual({
      sub: 'u',
      name: 'José',
    })
  })

  it.each([
    'not-a-jwt',
    'a.b',
    'a.!!!.c',
    `x.${window.btoa('[1]')}.y`,
  ])('returns undefined for %s', (jwt) => {
    expect(decodeJwtClaims(jwt)).toBeUndefined()
  })
})

describe('verifyIdToken', () => {
  const verify = async (
    idToken: string,
    accessToken = 'at',
    keys = [signer.jwk],
  ): Promise<void> => {
    await verifyIdToken({ idToken, accessToken, keys, subtle })
  }

  const signWithAtHash = async (
    claims: Record<string, unknown>,
  ): Promise<string> =>
    await signer.sign({ ...claims, at_hash: await signer.atHash('at') })

  it('accepts a token signed by a published key with a matching at_hash', async () => {
    await expect(
      verify(await signWithAtHash({ sub: 'u' }), 'at'),
    ).resolves.toBeUndefined()
  })

  it('rejects a token without at_hash', async () => {
    await expect(verify(await signer.sign({ sub: 'u' }))).rejects.toThrow(
      'no at_hash',
    )
  })

  it('rejects an access token the ID token was not issued with', async () => {
    const idToken = await signer.sign({ at_hash: await signer.atHash('at') })
    await expect(verify(idToken, 'swapped')).rejects.toThrow(
      'does not match the ID token',
    )
  })

  it('rejects a tampered payload', async () => {
    const [header, , signature] = (await signer.sign({ sub: 'u' })).split('.')
    const forgedPayload = makeJwt({ sub: 'admin' }).split('.')[1]
    await expect(
      verify(`${header}.${forgedPayload}.${signature}`),
    ).rejects.toThrow('signature is invalid')
  })

  it('rejects a token signed by another key', async () => {
    const other = await createIdTokenSigner('key-1')
    await expect(verify(await other.sign({ sub: 'u' }))).rejects.toThrow(
      'signature is invalid',
    )
  })

  it('rejects a token whose key id is not published', async () => {
    await expect(
      verify(await signer.sign({ sub: 'u' }), 'at', [
        { ...signer.jwk, kid: 'rotated' },
      ]),
    ).rejects.toThrow('signature is invalid')
  })

  it.each([
    { alg: 'none' },
    { alg: 'HS256' },
    {},
  ])('rejects header %p', async (header) => {
    await expect(verify(makeJwt({ sub: 'u' }, header))).rejects.toThrow(
      'Unsupported',
    )
  })
})

describe('validateIdTokenClaims', () => {
  const expected = {
    issuer: ISSUER,
    clientId: CLIENT_ID,
    nonce: 'n1',
    nowInSeconds: NOW,
  }
  const claims = {
    iss: ISSUER,
    sub: 'user-1',
    aud: CLIENT_ID,
    exp: NOW + 60,
    iat: NOW,
    nonce: 'n1',
    email: 'ada@example.com',
  }

  it('returns the claims as a profile', () => {
    expect(validateIdTokenClaims(claims, expected)).toEqual(claims)
  })

  it('accepts an audience list that includes the client as authorized party', () => {
    expect(
      validateIdTokenClaims(
        { ...claims, aud: ['other', CLIENT_ID], azp: CLIENT_ID },
        expected,
      ).aud,
    ).toEqual(['other', CLIENT_ID])
  })

  it('tolerates clock skew on expiry', () => {
    expect(() =>
      validateIdTokenClaims({ ...claims, exp: NOW - 120 }, expected),
    ).not.toThrow()
  })

  it.each([
    [{ sub: undefined }, 'subject'],
    [{ iss: 'https://evil.example.com' }, 'issuer'],
    [{ aud: 'other' }, 'audience'],
    [{ aud: ['other'] }, 'audience'],
    [{ aud: ['other', CLIENT_ID] }, 'authorized party'],
    [{ azp: 'other' }, 'authorized party'],
    [{ nonce: 'replayed' }, 'nonce'],
    [{ nonce: undefined }, 'nonce'],
    [{ exp: NOW - 3600 }, 'expired'],
    [{ iat: undefined }, 'issue time'],
  ])('rejects %p', (override, message) => {
    expect(() =>
      validateIdTokenClaims({ ...claims, ...override }, expected),
    ).toThrow(message)
  })
})

describe('ImplicitGrant', () => {
  let oidc: FakeUserManager
  let stateStore: SafeStateStore
  let loadFrame: Mock<(...args: [string, number]) => Promise<string>>

  const managerSettings = (
    overrides: Partial<UserManagerSettings> = {},
  ): UserManagerSettings => ({
    authority: ISSUER,
    client_id: CLIENT_ID,
    redirect_uri: APP_URI,
    scope: 'openid email',
    includeIdTokenInSilentRenew: true,
    ...overrides,
  })

  /** `null` stands for a context without Web Crypto */
  const createGrant = (
    cryptoApi: SubtleCrypto | null = subtle,
  ): ImplicitGrant =>
    new ImplicitGrant(oidc, stateStore, {
      loadFrame,
      subtle: cryptoApi ?? undefined,
    })

  /** Provider redirect answering the request in `authorizeUrl` */
  const callbackFor = async (
    authorizeUrl: string,
    overrides: Record<string, unknown> = {},
    params: Record<string, string> = {},
  ): Promise<string> => {
    const request = new URL(authorizeUrl).searchParams
    const now = Math.floor(Date.now() / 1000)
    const idToken = await signer.sign({
      iss: ISSUER,
      sub: 'user-1',
      aud: CLIENT_ID,
      exp: now + 3600,
      iat: now,
      nonce: request.get('nonce'),
      at_hash: await signer.atHash('fresh-token'),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      ...overrides,
    })
    const fragment = new URLSearchParams({
      access_token: 'fresh-token',
      token_type: 'Bearer',
      expires_in: '3600',
      id_token: idToken,
      state: request.get('state') ?? '',
      ...params,
    })
    return `${APP_URI}#${fragment.toString()}`
  }

  beforeEach(() => {
    oidc = createFakeUserManager(managerSettings(), {}, [signer.jwk])
    stateStore = new SafeStateStore(new InMemoryWebStorage())
    loadFrame = vi.fn<(...args: [string, number]) => Promise<string>>()
  })

  describe('redirect sign-in', () => {
    let location: ReturnType<typeof stubLocation>

    beforeEach(() => {
      location = stubLocation(APP_URI)
    })

    afterEach(() => {
      location.restore()
    })

    const redirect = async (data: unknown): Promise<string> => {
      await createGrant().signinRedirect(data)
      const [authorizeUrl] = location.assign.mock.calls[0]
      return authorizeUrl
    }

    it('navigates to the provider and stores the pending request', async () => {
      const authorizeUrl = await redirect({ returnUrl: '/studies/1' })
      const params = new URL(authorizeUrl).searchParams
      expect(params.get('response_type')).toBe('id_token token')
      expect(params.get('redirect_uri')).toBe(APP_URI)
      expect(params.get('prompt')).toBeNull()
      expect(await stateStore.getAllKeys()).toEqual([params.get('state')])
    })

    it('completes the callback into a stored user with the original state', async () => {
      const authorizeUrl = await redirect({ returnUrl: '/studies/1' })
      const user = await createGrant().signinRedirectCallback(
        await callbackFor(authorizeUrl),
      )

      expect(user.access_token).toBe('fresh-token')
      expect(user.state).toEqual({ returnUrl: '/studies/1' })
      expect(user.profile.email).toBe('ada@example.com')
      expect(user.expired).toBe(false)
      expect(oidc.storeUser).toHaveBeenCalledWith(user)
      expect(await stateStore.getAllKeys()).toEqual([])
    })

    it('rejects a replayed response', async () => {
      const authorizeUrl = await redirect(undefined)
      const callbackUrl = await callbackFor(authorizeUrl)
      await createGrant().signinRedirectCallback(callbackUrl)

      await expect(
        createGrant().signinRedirectCallback(callbackUrl),
      ).rejects.toThrow('No matching state')
    })

    it('rejects a response for a different request', async () => {
      const authorizeUrl = await redirect(undefined)
      await expect(
        createGrant().signinRedirectCallback(
          await callbackFor(authorizeUrl, {}, { state: 'forged' }),
        ),
      ).rejects.toThrow('No matching state')
      expect(oidc.storeUser).not.toHaveBeenCalled()
    })

    it('rejects an ID token issued for another request', async () => {
      const authorizeUrl = await redirect(undefined)
      await expect(
        createGrant().signinRedirectCallback(
          await callbackFor(authorizeUrl, { nonce: 'other' }),
        ),
      ).rejects.toThrow('nonce')
    })

    it('rejects an unsigned ID token', async () => {
      const authorizeUrl = await redirect(undefined)
      const state = new URL(authorizeUrl).searchParams.get('state') ?? ''
      const idToken = makeJwt({ iss: ISSUER, sub: 'user-1', aud: CLIENT_ID })
      await expect(
        createGrant().signinRedirectCallback(
          `${APP_URI}#access_token=t&id_token=${idToken}&state=${state}`,
        ),
      ).rejects.toThrow('Unsupported')
      expect(oidc.storeUser).not.toHaveBeenCalled()
    })

    it('refuses to sign in where tokens cannot be verified', async () => {
      const authorizeUrl = await redirect(undefined)
      await expect(
        createGrant(null).signinRedirectCallback(
          await callbackFor(authorizeUrl),
        ),
      ).rejects.toThrow('secure context')
    })

    it('surfaces provider errors', async () => {
      const authorizeUrl = await redirect(undefined)
      const state = new URL(authorizeUrl).searchParams.get('state') ?? ''
      await expect(
        createGrant().signinRedirectCallback(
          `${APP_URI}#error=access_denied&error_description=Denied&state=${state}`,
        ),
      ).rejects.toThrow('Denied')
    })
  })

  describe('user info', () => {
    const originalFetch = window.fetch

    afterEach(() => {
      window.fetch = originalFetch
    })

    const signInWithUserInfo = async (
      response: Partial<Response>,
    ): Promise<string | undefined> => {
      oidc = createFakeUserManager(
        managerSettings({ loadUserInfo: true }),
        {},
        [signer.jwk],
      )
      window.fetch = vi.fn(() => Promise.resolve(response as Response))
      loadFrame.mockImplementation((url) => callbackFor(url))
      const user = await createGrant().signinSilent()
      return user.profile.name
    }

    it('merges claims from the user info endpoint', async () => {
      expect(
        await signInWithUserInfo({
          ok: true,
          json: () => Promise.resolve({ sub: 'user-1', name: 'Countess' }),
        }),
      ).toBe('Countess')
      expect(window.fetch).toHaveBeenCalledWith(`${ISSUER}/userinfo`, {
        headers: { Authorization: 'Bearer fresh-token' },
      })
    })

    it('ignores user info for another subject', async () => {
      expect(
        await signInWithUserInfo({
          ok: true,
          json: () => Promise.resolve({ sub: 'user-2', name: 'Mallory' }),
        }),
      ).toBe('Ada Lovelace')
    })

    it('falls back to the ID token claims when the request fails', async () => {
      expect(await signInWithUserInfo({ ok: false })).toBe('Ada Lovelace')
    })
  })

  describe('silent renew', () => {
    it('renews in a frame without prompting, hinting the current user', async () => {
      oidc.stored = makeUser({ profile: makeProfile({ sub: 'user-1' }) })
      loadFrame.mockImplementation((url) => callbackFor(url))

      const user = await createGrant().signinSilent()

      const [authorizeUrl, timeout] = loadFrame.mock.calls[0]
      const params = new URL(authorizeUrl).searchParams
      expect(params.get('prompt')).toBe('none')
      expect(params.get('id_token_hint')).toBe('id-token')
      expect(timeout).toBe(10_000)
      expect(user.access_token).toBe('fresh-token')
      expect(oidc.stored).toBe(user)
    })

    it('rejects a renewal that signs in a different user', async () => {
      oidc.stored = makeUser({ profile: makeProfile({ sub: 'user-1' }) })
      loadFrame.mockImplementation((url) => callbackFor(url, { sub: 'user-2' }))

      await expect(createGrant().signinSilent()).rejects.toThrow(
        'different user',
      )
      expect(oidc.storeUser).not.toHaveBeenCalled()
    })

    it('propagates login_required from the provider', async () => {
      loadFrame.mockImplementation((url) => {
        const state = new URL(url).searchParams.get('state') ?? ''
        return Promise.resolve(`${APP_URI}#error=login_required&state=${state}`)
      })

      await expect(createGrant().signinSilent()).rejects.toThrow(
        'login_required',
      )
    })

    it('does not accept a silent response as a redirect callback', async () => {
      let callbackUrl = ''
      loadFrame.mockImplementation(async (url) => {
        callbackUrl = await callbackFor(url)
        throw new Error('frame closed')
      })
      await expect(createGrant().signinSilent()).rejects.toThrow('frame closed')

      await expect(
        createGrant().signinRedirectCallback(callbackUrl),
      ).rejects.toThrow('No matching state')
      expect(oidc.storeUser).not.toHaveBeenCalled()
    })
  })
})

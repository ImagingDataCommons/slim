import { InMemoryWebStorage, type UserManagerSettings } from 'oidc-client-ts'
import type { Mock } from 'vitest'

import type { OidcSettings } from '../../AppConfig'
import NotificationMiddleware from '../../services/NotificationMiddleware'
import OidcManager, {
  buildMetadataSeed,
  completeSilentRenewIfFrame,
} from '../OidcManager'
import { type OidcStores, SafeStateStore } from '../oidcStore'
import {
  CLIENT_ID,
  createFakeUserManager,
  type FakeUserManager,
  ISSUER,
  makeUser,
  stubLocation,
} from '../testing/fakeUserManager'

const APP_URI = 'http://localhost/'

const settings: OidcSettings = {
  authority: ISSUER,
  clientId: CLIENT_ID,
  scope: 'openid email',
}

const createStores = (): OidcStores => ({
  stateStore: new SafeStateStore(new InMemoryWebStorage()),
  userStore: new SafeStateStore(new InMemoryWebStorage()),
})

interface Setup {
  manager: OidcManager
  oidc: FakeUserManager
  stores: OidcStores
}

const setup = (
  overrides: Partial<OidcSettings> = {},
  metadata: Parameters<typeof createFakeUserManager>[1] = {},
): Setup => {
  const stores = createStores()
  let oidc: FakeUserManager | undefined
  const manager = new OidcManager(
    APP_URI,
    { ...settings, ...overrides },
    {
      stores,
      createUserManager: (managerSettings: UserManagerSettings) => {
        oidc = createFakeUserManager(managerSettings, metadata)
        return oidc
      },
    },
  )
  if (oidc === undefined) {
    throw new Error('user manager was not created')
  }
  return { manager, oidc, stores }
}

describe('buildMetadataSeed', () => {
  it('is undefined without endpoint overrides', () => {
    expect(buildMetadataSeed(settings)).toBeUndefined()
    expect(
      buildMetadataSeed({ ...settings, endSessionEndpoint: '' }),
    ).toBeUndefined()
  })

  it('overrides the configured endpoints', () => {
    expect(
      buildMetadataSeed({
        ...settings,
        authorizationEndpoint: `${ISSUER}/auth`,
        endSessionEndpoint: `${ISSUER}/logout`,
      }),
    ).toEqual({
      authorization_endpoint: `${ISSUER}/auth`,
      end_session_endpoint: `${ISSUER}/logout`,
    })
  })
})

describe('completeSilentRenewIfFrame', () => {
  const parentDescriptor = Object.getOwnPropertyDescriptor(window, 'parent')

  const runInFrame = async (
    url: string,
  ): Promise<{ handled: boolean; postMessage: Mock }> => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage },
    })
    window.history.replaceState({}, '', url)
    const handled = await completeSilentRenewIfFrame()
    return { handled, postMessage }
  }

  afterEach(() => {
    if (parentDescriptor !== undefined) {
      Object.defineProperty(window, 'parent', parentDescriptor)
    }
    window.history.replaceState({}, '', '/')
  })

  it('mounts the app in a top-level window', async () => {
    window.history.replaceState({}, '', '/?code=c&state=s')
    await expect(completeSilentRenewIfFrame()).resolves.toBe(false)
  })

  it('hands a callback in a frame to the parent without mounting', async () => {
    const { handled, postMessage } = await runInFrame(
      '/#error=login_required&state=s',
    )
    expect(handled).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ url: window.location.href }),
      window.location.origin,
    )
  })

  it('mounts embedded Slim in a frame that is not a callback', async () => {
    const { handled, postMessage } = await runInFrame('/studies/1')
    expect(handled).toBe(false)
    expect(postMessage).not.toHaveBeenCalled()
  })
})

describe('OidcManager', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(vi.fn())
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    vi.spyOn(NotificationMiddleware, 'onError').mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  describe('settings', () => {
    it('uses the authorization code flow with renewal on the app URI', () => {
      const { oidc, stores } = setup()
      expect(oidc.createdWith).toEqual({
        authority: ISSUER,
        client_id: CLIENT_ID,
        redirect_uri: APP_URI,
        silent_redirect_uri: APP_URI,
        post_logout_redirect_uri: `${APP_URI}logout`,
        scope: 'openid email',
        response_type: 'code',
        metadataSeed: undefined,
        loadUserInfo: true,
        automaticSilentRenew: true,
        monitorSession: true,
        includeIdTokenInSilentRenew: true,
        revokeTokensOnSignout: false,
        stateStore: stores.stateStore,
        userStore: stores.userStore,
      })
    })

    it('seeds discovery with configured endpoints on a single manager', () => {
      const { oidc } = setup({ endSessionEndpoint: `${ISSUER}/logout` })
      expect(oidc.createdWith.metadataSeed).toEqual({
        end_session_endpoint: `${ISSUER}/logout`,
      })
      expect(oidc.createdWith.automaticSilentRenew).toBe(true)
    })

    it('leaves renewal of implicit sessions to the manager', () => {
      const { oidc } = setup({ grantType: 'implicit' })
      expect(oidc.createdWith.automaticSilentRenew).toBe(false)
      expect(oidc.tokenExpiringListeners).toHaveLength(1)
    })
  })

  describe('signIn', () => {
    it('redirects with the current route in the state when signed out', async () => {
      window.history.replaceState({}, '', '/studies/1?gcp=x')
      const { manager, oidc } = setup()

      await expect(manager.signIn({})).resolves.toBe('redirected')

      expect(oidc.signinRedirect).toHaveBeenCalledWith({
        state: { returnUrl: '/studies/1?gcp=x' },
      })
    })

    it('redirects when the stored session has expired', async () => {
      const { manager, oidc } = setup()
      oidc.stored = makeUser({ expiresAt: 1 })

      await expect(manager.signIn({ returnUrl: '/x' })).resolves.toBe(
        'redirected',
      )
      expect(oidc.signinRedirect).toHaveBeenCalledWith({
        state: { returnUrl: '/x' },
      })
    })

    it('uses the implicit grant when configured', async () => {
      const location = stubLocation(`${APP_URI}studies/1`)
      try {
        const { manager, oidc } = setup({ grantType: 'implicit' })

        await expect(manager.signIn({})).resolves.toBe('redirected')

        expect(oidc.signinRedirect).not.toHaveBeenCalled()
        const [authorizeUrl] = location.assign.mock.calls[0]
        expect(new URL(authorizeUrl).searchParams.get('response_type')).toBe(
          'id_token token',
        )
      } finally {
        location.restore()
      }
    })

    it('completes the code callback and restores the deep link', async () => {
      window.history.replaceState({}, '', '/?code=c&state=s')
      const { manager, oidc } = setup()
      oidc.signinRedirectCallback.mockResolvedValue(
        makeUser({ accessToken: 't', state: { returnUrl: '/studies/1' } }),
      )
      const onSignIn = vi.fn()

      await expect(manager.signIn({ onSignIn })).resolves.toBe('completed')

      expect(onSignIn).toHaveBeenCalledWith({
        user: { name: 'Ada Lovelace', email: 'ada@example.com' },
        authorization: 'Bearer t',
        returnUrl: '/studies/1',
      })
      expect(window.location.search).toBe('')
    })

    it('drops an off-site return URL from the callback', async () => {
      window.history.replaceState({}, '', '/?code=c&state=s')
      const { manager, oidc } = setup()
      oidc.signinRedirectCallback.mockResolvedValue(
        makeUser({ state: { returnUrl: '//evil.example.com' } }),
      )
      const onSignIn = vi.fn()

      await manager.signIn({ onSignIn })

      expect(onSignIn).toHaveBeenCalledWith(
        expect.objectContaining({ returnUrl: undefined }),
      )
    })

    it('reuses a live session without the persisted return URL', async () => {
      const { manager, oidc } = setup()
      oidc.stored = makeUser({ state: { returnUrl: '/studies/1' } })
      const onSignIn = vi.fn()

      await expect(manager.signIn({ onSignIn })).resolves.toBe('completed')

      expect(oidc.signinRedirect).not.toHaveBeenCalled()
      expect(onSignIn).toHaveBeenCalledWith(
        expect.objectContaining({ returnUrl: undefined }),
      )
    })
  })

  describe('authorization', () => {
    it('returns the header for a live session', async () => {
      const { manager, oidc } = setup()
      oidc.stored = makeUser({ accessToken: 'live' })
      await expect(manager.getAuthorization()).resolves.toBe('Bearer live')
    })

    it('returns undefined for an expired session', async () => {
      const { manager, oidc } = setup()
      oidc.stored = makeUser({ expiresAt: 1 })
      await expect(manager.getAuthorization()).resolves.toBeUndefined()
    })

    it('notifies listeners when the library loads a user', async () => {
      const { manager, oidc } = setup()
      const listener = vi.fn()
      manager.onAuthorizationChange(listener)

      await oidc.events.load(makeUser({ accessToken: 'renewed' }))

      expect(listener).toHaveBeenCalledWith('Bearer renewed')
    })

    it('stops notifying after unsubscribe', async () => {
      const { manager, oidc } = setup()
      const listener = vi.fn()
      manager.onAuthorizationChange(listener)()

      await oidc.events.load(makeUser())

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('renewAuthorization', () => {
    it('renews silently and notifies listeners', async () => {
      const { manager, oidc } = setup()
      oidc.signinSilent.mockResolvedValue(makeUser({ accessToken: 'new' }))
      const listener = vi.fn()
      manager.onAuthorizationChange(listener)

      await expect(manager.renewAuthorization()).resolves.toBe('Bearer new')
      expect(listener).toHaveBeenCalledWith('Bearer new')
    })

    it('returns undefined when silent renew fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(vi.fn())
      const { manager, oidc } = setup()
      oidc.signinSilent.mockRejectedValue(new Error('login_required'))

      await expect(manager.renewAuthorization()).resolves.toBeUndefined()
    })

    it('renews implicit sessions through the implicit grant', async () => {
      vi.spyOn(console, 'warn').mockImplementation(vi.fn())
      const { manager, oidc } = setup({ grantType: 'implicit' })
      const getAuthorizationEndpoint = vi.fn(() =>
        Promise.reject(new Error('offline')),
      )
      oidc.metadataService.getAuthorizationEndpoint = getAuthorizationEndpoint

      await expect(manager.renewAuthorization()).resolves.toBeUndefined()

      expect(getAuthorizationEndpoint).toHaveBeenCalled()
      expect(oidc.signinSilent).not.toHaveBeenCalled()
    })
  })

  describe('signOut', () => {
    let location: ReturnType<typeof stubLocation>

    beforeEach(() => {
      location = stubLocation(APP_URI)
    })

    afterEach(() => {
      location.restore()
    })

    it('clears the local session without an end-session endpoint', async () => {
      const { manager, oidc } = setup()

      await manager.signOut()

      expect(oidc.removeUser).toHaveBeenCalled()
      expect(oidc.signoutRedirect).not.toHaveBeenCalled()
      expect(location.assign).toHaveBeenCalledWith(`${APP_URI}logout`)
    })

    it('redirects to the provider and revokes tokens when supported', async () => {
      const { manager, oidc } = setup(
        {},
        {
          end_session_endpoint: `${ISSUER}/logout`,
          revocation_endpoint: `${ISSUER}/revoke`,
        },
      )

      await manager.signOut()

      expect(oidc.revokeTokens).toHaveBeenCalled()
      expect(oidc.signoutRedirect).toHaveBeenCalled()
    })

    it('still signs out when revocation fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(vi.fn())
      const { manager, oidc } = setup(
        {},
        {
          end_session_endpoint: `${ISSUER}/logout`,
          revocation_endpoint: `${ISSUER}/revoke`,
        },
      )
      oidc.revokeTokens.mockRejectedValue(new Error('unsupported_token_type'))

      await manager.signOut()

      expect(oidc.signoutRedirect).toHaveBeenCalled()
    })

    it('does not attempt revocation without an endpoint', async () => {
      const { manager, oidc } = setup(
        {},
        { end_session_endpoint: `${ISSUER}/logout` },
      )

      await manager.signOut()

      expect(oidc.revokeTokens).not.toHaveBeenCalled()
      expect(oidc.signoutRedirect).toHaveBeenCalled()
    })

    it('falls back to a local sign-out when the redirect fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(vi.fn())
      const { manager, oidc } = setup(
        {},
        { end_session_endpoint: `${ISSUER}/logout` },
      )
      oidc.signoutRedirect.mockRejectedValue(new Error('offline'))

      await manager.signOut()

      expect(oidc.removeUser).toHaveBeenCalled()
      expect(location.assign).toHaveBeenCalledWith(`${APP_URI}logout`)
    })
  })
})

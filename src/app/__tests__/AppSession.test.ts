import type AppConfig from '../../AppConfig'
import type { OidcSettings } from '../../AppConfig'
import type {
  AuthManager,
  AuthorizationCallback,
  SignInOutcome,
} from '../../auth'
import {
  OIDC_CONFIG_STORAGE_KEY,
  readCachedOidcConfig,
} from '../../auth/oidcConfig'
import NotificationMiddleware from '../../services/NotificationMiddleware'
import {
  SERVER_MODE_STORAGE_KEY,
  SERVER_URL_STORAGE_KEY,
} from '../../utils/serverSelectionStorage'
import { AppSession } from '../AppSession'

const PRIMARY_URL = 'https://dicom.example.com/dicomWeb'
const CUSTOM_URL = 'https://custom.example.com/dicomWeb'

const USER = { name: 'Ada Lovelace', email: 'ada@example.com' }

type SignInArgs = Parameters<AuthManager['signIn']>[0]

interface FakeAuth extends AuthManager {
  signIn: jest.Mock<Promise<SignInOutcome>, [SignInArgs]>
  renewAuthorization: jest.Mock<Promise<string | undefined>, []>
  onAuthorizationChange: jest.Mock<() => void, [AuthorizationCallback]>
  /** Unsubscribe functions handed out by onAuthorizationChange */
  unsubscribes: jest.Mock[]
}

/** Signs in with `Bearer t` unless `signIn` is overridden */
const createFakeAuth = (): FakeAuth => {
  const unsubscribes: jest.Mock[] = []
  return {
    unsubscribes,
    signIn: jest.fn(({ onSignIn }: SignInArgs) => {
      onSignIn?.({ user: USER, authorization: 'Bearer t' })
      return Promise.resolve<SignInOutcome>('completed')
    }),
    signOut: jest.fn(() => Promise.resolve()),
    getAuthorization: jest.fn(() => Promise.resolve('Bearer t')),
    getUser: jest.fn(() => Promise.resolve(USER)),
    renewAuthorization: jest.fn(() =>
      Promise.resolve<string | undefined>(undefined),
    ),
    onAuthorizationChange: jest.fn((_callback: AuthorizationCallback) => {
      const unsubscribe = jest.fn()
      unsubscribes.push(unsubscribe)
      return unsubscribe
    }),
  }
}

const createConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  servers: [{ id: 'primary', url: PRIMARY_URL, write: false }],
  path: '/',
  annotations: [],
  ...overrides,
})

const OIDC: OidcSettings = {
  authority: 'https://idp.example.com',
  clientId: 'slim',
  scope: 'openid',
}

interface Setup {
  session: AppSession
  auth: FakeAuth
  createAuth: jest.Mock<AuthManager, [string, OidcSettings]>
  reload: jest.Mock<void, []>
}

const setup = (config: AppConfig = createConfig({ oidc: OIDC })): Setup => {
  const auth = createFakeAuth()
  const createAuth = jest.fn<AuthManager, [string, OidcSettings]>(() => auth)
  const reload = jest.fn<void, []>()
  const session = new AppSession({
    config,
    createAuth,
    reload,
    confirmDisclosure: () => Promise.resolve(false),
  })
  return { session, auth, createAuth, reload }
}

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe('AppSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.spyOn(console, 'info').mockImplementation(jest.fn())
    jest.spyOn(console, 'error').mockImplementation(jest.fn())
    jest.spyOn(NotificationMiddleware, 'onError').mockImplementation(jest.fn())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('sign-in', () => {
    it('is ready right away without OIDC', () => {
      const { session, createAuth } = setup(createConfig())
      session.start()

      expect(createAuth).not.toHaveBeenCalled()
      expect(session.getSnapshot()).toEqual(
        expect.objectContaining({ isLoading: false, wasAuthSuccessful: true }),
      )
    })

    it('signs in and credentials the clients', async () => {
      const { session, auth } = setup()
      const updateHeaders = jest.spyOn(
        session.getSnapshot().defaultClients.default,
        'updateHeaders',
      )
      session.start()
      await flush()

      expect(auth.signIn).toHaveBeenCalledTimes(1)
      expect(updateHeaders).toHaveBeenCalledWith({ Authorization: 'Bearer t' })
      expect(session.getSnapshot()).toEqual(
        expect.objectContaining({
          user: USER,
          isLoading: false,
          wasAuthSuccessful: true,
        }),
      )
    })

    it('keeps loading while the page is redirected to the provider', async () => {
      const { session, auth } = setup()
      auth.signIn.mockResolvedValue('redirected')
      session.start()
      await flush()

      expect(session.getSnapshot().isLoading).toBe(true)
    })

    it('reports a failed sign-in', async () => {
      const { session, auth } = setup()
      auth.signIn.mockRejectedValue(new Error('offline'))
      session.start()
      await flush()

      expect(session.getSnapshot()).toEqual(
        expect.objectContaining({
          isLoading: false,
          wasAuthSuccessful: false,
          signInFailureMessage: undefined,
        }),
      )
    })

    it('discards a cached OIDC config that fails to sign in', async () => {
      window.localStorage.setItem(
        OIDC_CONFIG_STORAGE_KEY,
        JSON.stringify({
          ...OIDC,
          authority: 'https://custom-idp.example.com',
        }),
      )
      const { session, auth, createAuth } = setup()
      auth.signIn.mockRejectedValue(new Error('unknown client'))
      session.start()
      await flush()

      expect(createAuth).toHaveBeenCalledWith(
        'http://localhost/',
        expect.objectContaining({
          authority: 'https://custom-idp.example.com',
        }),
      )
      expect(readCachedOidcConfig()).toBeUndefined()
      expect(session.getSnapshot().signInFailureMessage).toMatch(
        /custom OIDC configuration failed/,
      )
    })

    it('signs in once across remounts and re-subscribes to token updates', async () => {
      const { session, auth } = setup()
      const cleanup = session.start()
      cleanup()
      session.start()
      await flush()

      expect(auth.signIn).toHaveBeenCalledTimes(1)
      expect(auth.onAuthorizationChange).toHaveBeenCalledTimes(2)
      expect(auth.unsubscribes[0]).toHaveBeenCalled()
    })

    it('applies renewed tokens from the identity provider', () => {
      const { session, auth } = setup()
      session.start()
      const updateHeaders = jest.spyOn(
        session.getSnapshot().defaultClients.default,
        'updateHeaders',
      )
      const [listener] = auth.onAuthorizationChange.mock.calls[0]

      listener('Bearer renewed')

      expect(updateHeaders).toHaveBeenCalledWith({
        Authorization: 'Bearer renewed',
      })
    })

    it('notifies subscribers on every change', async () => {
      const { session } = setup()
      const listener = jest.fn()
      session.subscribe(listener)
      session.start()
      await flush()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('server selection', () => {
    it('re-applies a legacy stored URL without a mode as custom', () => {
      window.localStorage.setItem(SERVER_URL_STORAGE_KEY, CUSTOM_URL)
      const { session } = setup(createConfig())
      session.start()

      const { clients, defaultClients } = session.getSnapshot()
      expect(clients.default.baseURL).toBe(CUSTOM_URL)
      expect(new Set(Object.values(clients)).size).toBe(1)
      expect(defaultClients.default.baseURL).toBe(PRIMARY_URL)
    })

    it('ignores a stored URL in default mode', () => {
      window.localStorage.setItem(SERVER_URL_STORAGE_KEY, CUSTOM_URL)
      window.localStorage.setItem(SERVER_MODE_STORAGE_KEY, 'default')
      const { session } = setup(createConfig())
      session.start()

      const { clients, defaultClients } = session.getSnapshot()
      expect(clients).toBe(defaultClients)
    })

    it('switches to a read-only client without forwarding the token', async () => {
      const { session } = setup(
        createConfig({
          servers: [
            {
              id: 'primary',
              url: PRIMARY_URL,
              write: false,
              sendAuthorization: true,
            },
          ],
        }),
      )
      session.getSnapshot().defaultClients.default.updateHeaders({
        Authorization: 'Bearer t',
        'X-Api-Key': 'k',
      })

      await session.selectServer({ url: ` ${CUSTOM_URL} ` })

      const { clients } = session.getSnapshot()
      expect(clients.default.baseURL).toBe(CUSTOM_URL)
      expect(clients.default.headers).toEqual({ 'X-Api-Key': 'k' })
      expect(window.localStorage.getItem(SERVER_URL_STORAGE_KEY)).toBe(
        CUSTOM_URL,
      )
    })

    it('returns to the configured servers for an empty selection', async () => {
      const { session } = setup(createConfig())
      await session.selectServer({ url: CUSTOM_URL })
      await session.selectServer({ url: '' })

      const { clients, defaultClients } = session.getSnapshot()
      expect(clients).toBe(defaultClients)
    })

    it('reloads to apply a new OIDC configuration', async () => {
      const { session, reload } = setup(createConfig())
      const { clients } = session.getSnapshot()

      await session.selectServer({ url: CUSTOM_URL, oidc: OIDC })

      expect(reload).toHaveBeenCalledTimes(1)
      expect(session.getSnapshot().clients).toBe(clients)
    })
  })

  describe('ensureAuthorized', () => {
    it('renews silently and remounts the views', async () => {
      const { session, auth } = setup()
      auth.renewAuthorization.mockResolvedValue('Bearer renewed')

      await Promise.all([
        session.ensureAuthorized(),
        session.ensureAuthorized(),
      ])

      expect(auth.renewAuthorization).toHaveBeenCalledTimes(1)
      expect(session.getSnapshot().authRecoveryKey).toBe(1)
    })

    it('falls back to interactive sign-in and remounts when it completes', async () => {
      const { session, auth } = setup()

      await session.ensureAuthorized()
      await session.ensureAuthorized()

      expect(auth.signIn).toHaveBeenCalledTimes(2)
      expect(session.getSnapshot().authRecoveryKey).toBe(2)
    })

    it('stays locked once the page is redirected to the provider', async () => {
      const { session, auth } = setup()
      auth.signIn.mockResolvedValue('redirected')

      await session.ensureAuthorized()
      await session.ensureAuthorized()

      expect(auth.renewAuthorization).toHaveBeenCalledTimes(1)
      expect(session.getSnapshot().authRecoveryKey).toBe(0)
    })

    it('does nothing without OIDC', async () => {
      const { session, auth } = setup(createConfig())
      await session.ensureAuthorized()
      expect(auth.renewAuthorization).not.toHaveBeenCalled()
    })
  })

  describe('DICOMweb errors', () => {
    it('recovers authorization on 401', async () => {
      const { session, auth } = setup()
      session.handleDicomWebError(
        { request: new XMLHttpRequest(), response: '', status: 401 },
        { id: 'primary', write: false },
      )
      await flush()
      expect(auth.renewAuthorization).toHaveBeenCalled()
    })

    it('shows the configured message for a status', () => {
      const { session } = setup(createConfig())
      session.handleDicomWebError(
        { request: new XMLHttpRequest(), response: '', status: 503 },
        {
          id: 'primary',
          write: false,
          errorMessages: [{ status: 503, message: 'Down for maintenance' }],
        },
      )
      expect(session.getSnapshot().error).toEqual({
        status: 503,
        message: 'Down for maintenance',
      })
    })
  })
})

import type { AuthManager } from '../../auth'
import NotificationMiddleware from '../../services/NotificationMiddleware'
import {
  clearAuthorizationDecisions,
  readAuthorizationDecision,
  writeAuthorizationDecision,
} from '../../utils/authPolicy'
import {
  createTokenDisclosurePolicy,
  decideDisclosure,
} from '../tokenDisclosure'

const CONFIGURED = 'https://dicom.example.com'
const UNKNOWN = 'https://unknown.example.com'
const AUTHORITY = 'https://idp.example.com'

const createAuth = (
  getAuthorization: AuthManager['getAuthorization'] = () =>
    Promise.resolve('Bearer t'),
): AuthManager => ({
  signIn: jest.fn(() => Promise.resolve('completed' as const)),
  signOut: jest.fn(() => Promise.resolve()),
  getAuthorization: jest.fn(getAuthorization),
  getUser: jest.fn(() => Promise.resolve({ name: 'A', email: 'a@b.c' })),
  renewAuthorization: jest.fn(() => Promise.resolve(undefined)),
  onAuthorizationChange: jest.fn(() => () => {}),
})

describe('decideDisclosure', () => {
  it.each([
    [false, undefined, true, 'refuse-insecure'],
    [false, 'granted', true, 'refuse-insecure'],
    [true, 'denied', true, 'withhold'],
    [true, undefined, false, 'ask'],
    [true, undefined, true, 'grant'],
    [true, 'granted', false, 'grant'],
  ] as const)('secure=%p remembered=%p configured=%p -> %p', (isSecure, remembered, isConfigured, expected) => {
    expect(decideDisclosure({ isSecure, remembered, isConfigured })).toBe(
      expected,
    )
  })
})

describe('createTokenDisclosurePolicy', () => {
  let confirm: jest.Mock<Promise<boolean>, [string, string | undefined]>
  let onAuthorization: jest.Mock<void, [string]>

  const createPolicy = (
    auth: AuthManager | null = createAuth(),
  ): ReturnType<typeof createTokenDisclosurePolicy> =>
    createTokenDisclosurePolicy({
      auth: auth ?? undefined,
      configuredOrigins: new Set([CONFIGURED, 'http://intranet.example']),
      oidcAuthority: AUTHORITY,
      confirm,
      onAuthorization,
    })

  beforeEach(() => {
    clearAuthorizationDecisions()
    confirm = jest.fn((_origin: string, _authority: string | undefined) =>
      Promise.resolve(true),
    )
    onAuthorization = jest.fn()
    jest.spyOn(console, 'info').mockImplementation(jest.fn())
    jest.spyOn(console, 'warn').mockImplementation(jest.fn())
    jest.spyOn(NotificationMiddleware, 'onError').mockImplementation(jest.fn())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends nothing without sign-in', async () => {
    await expect(
      createPolicy(null).requestAuthorization(CONFIGURED),
    ).resolves.toBeUndefined()
  })

  it('credentials configured origins without asking', async () => {
    await expect(createPolicy().requestAuthorization(CONFIGURED)).resolves.toBe(
      'Bearer t',
    )

    expect(confirm).not.toHaveBeenCalled()
    expect(readAuthorizationDecision(CONFIGURED)).toBe('granted')
    expect(onAuthorization).toHaveBeenCalledWith('Bearer t')
  })

  it('refuses insecure origins even when configured', async () => {
    await expect(
      createPolicy().requestAuthorization('http://intranet.example'),
    ).resolves.toBeUndefined()

    expect(confirm).not.toHaveBeenCalled()
    expect(NotificationMiddleware.onError).toHaveBeenCalled()
  })

  it('asks before sending the token to an unknown origin', async () => {
    await expect(createPolicy().requestAuthorization(UNKNOWN)).resolves.toBe(
      'Bearer t',
    )

    expect(confirm).toHaveBeenCalledWith(UNKNOWN, AUTHORITY)
    expect(readAuthorizationDecision(UNKNOWN)).toBe('granted')
  })

  it('remembers a refusal and does not ask again', async () => {
    confirm.mockResolvedValue(false)
    const policy = createPolicy()

    await expect(policy.requestAuthorization(UNKNOWN)).resolves.toBeUndefined()
    await expect(policy.requestAuthorization(UNKNOWN)).resolves.toBeUndefined()

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(readAuthorizationDecision(UNKNOWN)).toBe('denied')
    expect(onAuthorization).not.toHaveBeenCalled()
  })

  it('shares one prompt between simultaneous challenges', async () => {
    const policy = createPolicy()

    await Promise.all([
      policy.requestAuthorization(UNKNOWN),
      policy.requestAuthorization(UNKNOWN),
    ])

    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('never rejects when the token cannot be obtained', async () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn())
    const policy = createPolicy(
      createAuth(() => Promise.reject(new Error('expired'))),
    )

    await expect(
      policy.requestAuthorization(CONFIGURED),
    ).resolves.toBeUndefined()
  })

  it('reports remembered grants as pre-authorized', () => {
    writeAuthorizationDecision(UNKNOWN, 'granted')
    const policy = createPolicy()
    expect(policy.isPreAuthorized(UNKNOWN)).toBe(true)
    expect(policy.isPreAuthorized(CONFIGURED)).toBe(false)
  })
})

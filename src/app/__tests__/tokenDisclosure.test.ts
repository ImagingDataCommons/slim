import type { Mock } from 'vitest'
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
  signIn: vi.fn(() => Promise.resolve('completed' as const)),
  signOut: vi.fn(() => Promise.resolve()),
  getAuthorization: vi.fn(getAuthorization),
  getUser: vi.fn(() => Promise.resolve({ name: 'A', email: 'a@b.c' })),
  renewAuthorization: vi.fn(() => Promise.resolve(undefined)),
  onAuthorizationChange: vi.fn(() => () => {}),
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
  let confirm: Mock<(...args: [string, string | undefined]) => Promise<boolean>>
  let onAuthorization: Mock<(...args: [string]) => void>

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
    confirm = vi.fn((_origin: string, _authority: string | undefined) =>
      Promise.resolve(true),
    )
    onAuthorization = vi.fn()
    vi.spyOn(console, 'info').mockImplementation(vi.fn())
    vi.spyOn(console, 'warn').mockImplementation(vi.fn())
    vi.spyOn(NotificationMiddleware, 'onError').mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    vi.spyOn(console, 'error').mockImplementation(vi.fn())
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

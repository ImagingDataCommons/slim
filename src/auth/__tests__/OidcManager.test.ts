import { UserManager } from 'oidc-client'

import OidcManager from '../OidcManager'

jest.mock('oidc-client', () => ({ UserManager: jest.fn() }))

const MockUserManager = UserManager as unknown as jest.Mock

const settings = {
  authority: 'https://idp.example.com',
  clientId: 'slim',
  scope: 'openid',
}

const mockUserManagers = (getMetadata: jest.Mock): void => {
  MockUserManager.mockImplementation(() => ({
    events: { addUserLoaded: jest.fn() },
    metadataService: { getMetadata },
    getUser: jest.fn().mockResolvedValue({ profile: {} }),
  }))
}

const constructorSettings = (): Array<Record<string, unknown>> =>
  MockUserManager.mock.calls.map(([options]) => options)

describe('OidcManager', () => {
  it('creates a single renewing manager when no metadata override is set', async () => {
    mockUserManagers(jest.fn().mockResolvedValue({}))
    const manager = new OidcManager('https://app.example.com', settings)
    await manager.getUser()

    const [only, ...rest] = constructorSettings()
    expect(rest).toHaveLength(0)
    expect(only.automaticSilentRenew).toBe(true)
    expect(only.monitorSession).toBeUndefined()
  })

  it('renews and monitors only on the manager built with the override', async () => {
    mockUserManagers(jest.fn().mockResolvedValue({}))
    const manager = new OidcManager('https://app.example.com', {
      ...settings,
      endSessionEndpoint: 'https://idp.example.com/logout',
    })
    await manager.getUser()

    const [discovery, active, ...rest] = constructorSettings()
    expect(rest).toHaveLength(0)
    expect(discovery.automaticSilentRenew).toBe(false)
    expect(discovery.monitorSession).toBe(false)
    expect(active.automaticSilentRenew).toBe(true)
    expect(active.monitorSession).toBeUndefined()
    expect(active.metadata).toEqual({
      end_session_endpoint: 'https://idp.example.com/logout',
    })
  })

  it('falls back to a renewing manager without metadata when discovery fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn())
    mockUserManagers(jest.fn().mockRejectedValue(new Error('offline')))
    const manager = new OidcManager('https://app.example.com', {
      ...settings,
      authorizationEndpoint: 'https://idp.example.com/authorize',
    })
    await manager.getUser()

    const [, active, ...rest] = constructorSettings()
    expect(rest).toHaveLength(0)
    expect(active.automaticSilentRenew).toBe(true)
    expect(active.metadata).toBeUndefined()
  })
})

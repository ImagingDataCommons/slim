import { UserManager } from 'oidc-client'

import OidcManager from '../OidcManager'

jest.mock('oidc-client', () => ({ UserManager: jest.fn() }))

const MockUserManager = UserManager as unknown as jest.Mock

const settings = {
  authority: 'https://idp.example.com',
  clientId: 'slim',
  scope: 'openid',
}

describe('OidcManager', () => {
  beforeEach(() => {
    MockUserManager.mockImplementation(() => ({
      events: { addUserLoaded: jest.fn() },
      metadataService: { getMetadata: jest.fn().mockResolvedValue({}) },
      stopSilentRenew: jest.fn(),
      getUser: jest.fn().mockResolvedValue({ profile: {} }),
    }))
  })

  it('keeps a single UserManager when no metadata override is set', async () => {
    const manager = new OidcManager('https://app.example.com', settings)
    await manager.getUser()

    expect(MockUserManager).toHaveBeenCalledTimes(1)
    const [first] = MockUserManager.mock.results
    expect(first.value.stopSilentRenew).not.toHaveBeenCalled()
  })

  it('stops silent renew on the replaced UserManager after a metadata override', async () => {
    const manager = new OidcManager('https://app.example.com', {
      ...settings,
      endSessionEndpoint: 'https://idp.example.com/logout',
    })
    await manager.getUser()

    expect(MockUserManager).toHaveBeenCalledTimes(2)
    const [first, second] = MockUserManager.mock.results
    expect(first.value.stopSilentRenew).toHaveBeenCalledTimes(1)
    expect(second.value.stopSilentRenew).not.toHaveBeenCalled()
  })
})

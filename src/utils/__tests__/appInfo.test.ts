import { buildAppInfo, SLIM_IMPLEMENTATION_UID } from '../appInfo'

describe('buildAppInfo', () => {
  it('adds the Slim implementation UID', () => {
    expect(
      buildAppInfo({
        name: 'Slim',
        version: '1.0.0',
        homepage: 'https://example.org',
        organization: 'IDC',
      }),
    ).toEqual({
      name: 'Slim',
      version: '1.0.0',
      homepage: 'https://example.org',
      organization: 'IDC',
      uid: SLIM_IMPLEMENTATION_UID,
    })
  })

  it('leaves the organization optional', () => {
    expect(
      buildAppInfo({ name: 'Slim', version: '1', homepage: '' }).organization,
    ).toBeUndefined()
  })
})

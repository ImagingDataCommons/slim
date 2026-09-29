import {
  isValidOidcConfig,
  OIDC_CONFIG_STORAGE_KEY,
  parseOidcConfig,
  readCachedOidcConfig,
} from '../oidcConfig'

const settings = {
  authority: 'https://idp.example.com',
  clientId: 'slim',
  scope: 'openid email',
}

describe('parseOidcConfig', () => {
  it('parses JSON', () => {
    expect(parseOidcConfig(JSON.stringify(settings))).toEqual(settings)
  })

  it('parses JavaScript object notation with unquoted keys', () => {
    const input =
      '{ authority: "https://idp.example.com", clientId: "slim", ' +
      'scope: "openid email", grantType: "implicit" }'
    expect(parseOidcConfig(input)).toEqual({
      ...settings,
      grantType: 'implicit',
    })
  })

  it('drops unknown keys', () => {
    const input = JSON.stringify({ ...settings, extra: 'ignored' })
    expect(parseOidcConfig(input)).toEqual(settings)
  })

  it.each([
    ['empty input', ''],
    ['whitespace', '   '],
    ['malformed input', '{ authority: '],
    ['missing scope', JSON.stringify({ ...settings, scope: undefined })],
    ['empty clientId', JSON.stringify({ ...settings, clientId: '' })],
    ['non-object', '"text"'],
  ])('returns undefined for %s', (_label, input) => {
    expect(parseOidcConfig(input)).toBeUndefined()
  })

  it('returns undefined for null', () => {
    expect(parseOidcConfig(null)).toBeUndefined()
  })
})

describe('isValidOidcConfig', () => {
  it('accepts an empty config because OIDC is optional', () => {
    expect(isValidOidcConfig('')).toBe(true)
    expect(isValidOidcConfig(null)).toBe(true)
  })

  it('accepts a complete config', () => {
    expect(isValidOidcConfig(JSON.stringify(settings))).toBe(true)
  })

  it('rejects an incomplete config', () => {
    expect(
      isValidOidcConfig(JSON.stringify({ ...settings, authority: '' })),
    ).toBe(false)
  })
})

describe('readCachedOidcConfig', () => {
  afterEach(() => {
    window.localStorage.removeItem(OIDC_CONFIG_STORAGE_KEY)
  })

  it('reads the cached config', () => {
    window.localStorage.setItem(
      OIDC_CONFIG_STORAGE_KEY,
      JSON.stringify(settings),
    )
    expect(readCachedOidcConfig()).toEqual(settings)
  })

  it('returns undefined when nothing is cached', () => {
    expect(readCachedOidcConfig()).toBeUndefined()
  })
})

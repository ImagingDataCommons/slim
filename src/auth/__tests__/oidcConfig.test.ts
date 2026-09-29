import {
  getOidcConfigToApply,
  isValidOidcConfig,
  OIDC_CONFIG_STORAGE_KEY,
  parseOidcConfig,
  readCachedOidcConfig,
  resetCachedOidcConfigFromUrl,
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

describe('getOidcConfigToApply', () => {
  const input = JSON.stringify(settings)

  it('applies a new config', () => {
    expect(getOidcConfigToApply(input, null)).toEqual(settings)
  })

  it('applies a config that differs from the cached one', () => {
    const cached = JSON.stringify({ ...settings, clientId: 'other' })
    expect(getOidcConfigToApply(input, cached)).toEqual(settings)
  })

  it('skips the config that is already cached', () => {
    expect(getOidcConfigToApply(`  ${input}\n`, input)).toBeUndefined()
  })

  it('skips an empty or invalid entry', () => {
    expect(getOidcConfigToApply('', input)).toBeUndefined()
    expect(getOidcConfigToApply('{ authority: ', null)).toBeUndefined()
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

describe('resetCachedOidcConfigFromUrl', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      OIDC_CONFIG_STORAGE_KEY,
      JSON.stringify(settings),
    )
  })

  afterEach(() => {
    window.localStorage.removeItem(OIDC_CONFIG_STORAGE_KEY)
    window.history.replaceState(null, '', '/')
  })

  it('clears the cache and drops the parameter when it is present', () => {
    window.history.replaceState(null, '', '/studies?resetOidc&tab=2')

    expect(resetCachedOidcConfigFromUrl()).toBe(true)
    expect(readCachedOidcConfig()).toBeUndefined()
    expect(window.location.pathname).toBe('/studies')
    expect(window.location.search).toBe('?tab=2')
  })

  it('keeps the cache when the parameter is absent', () => {
    window.history.replaceState(null, '', '/studies?tab=2')

    expect(resetCachedOidcConfigFromUrl()).toBe(false)
    expect(readCachedOidcConfig()).toEqual(settings)
    expect(window.location.search).toBe('?tab=2')
  })
})

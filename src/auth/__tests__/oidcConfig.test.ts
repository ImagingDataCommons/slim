import type { MockInstance } from 'vitest'
import {
  clearAuthorizationDecisions,
  readAuthorizationDecision,
  writeAuthorizationDecision,
} from '../../utils/authPolicy'
import {
  cacheOidcConfigInput,
  getOidcConfigToApply,
  isValidOidcConfig,
  OIDC_CONFIG_STORAGE_KEY,
  parseOidcConfig,
  readCachedOidcConfig,
  readCachedOidcConfigInput,
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

  it('keeps JSON string values that look like unquoted keys', () => {
    const input = JSON.stringify({ ...settings, scope: 'openid,profile:read' })
    expect(parseOidcConfig(input)).toEqual({
      ...settings,
      scope: 'openid,profile:read',
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
    expect(getOidcConfigToApply(input, '')).toEqual(settings)
  })

  it('applies a config that differs from the cached one', () => {
    const cached = JSON.stringify({ ...settings, clientId: 'other' })
    expect(getOidcConfigToApply(input, cached)).toEqual(settings)
  })

  it('skips the config that is already cached', () => {
    expect(getOidcConfigToApply(`  ${input}\n`, input)).toBeUndefined()
  })

  it('skips an invalid entry', () => {
    expect(getOidcConfigToApply('{ authority: ', '')).toBeUndefined()
  })

  it('falls back to the deployment config when the entry is emptied', () => {
    expect(getOidcConfigToApply('  ', input)).toBeNull()
  })

  it('does nothing when the entry stays empty', () => {
    expect(getOidcConfigToApply('', '')).toBeUndefined()
  })
})

describe('cacheOidcConfigInput', () => {
  const input = JSON.stringify(settings)
  const origin = 'https://dicomweb.example.com'

  beforeEach(() => {
    writeAuthorizationDecision(origin, 'granted')
  })

  afterEach(() => {
    window.localStorage.removeItem(OIDC_CONFIG_STORAGE_KEY)
    clearAuthorizationDecisions()
  })

  it('caches a valid entry and forgets grants made for another provider', () => {
    cacheOidcConfigInput(`  ${input}\n`)

    expect(readCachedOidcConfigInput()).toBe(input)
    expect(readAuthorizationDecision(origin)).toBeUndefined()
  })

  it('keeps grants when the provider does not change', () => {
    window.localStorage.setItem(OIDC_CONFIG_STORAGE_KEY, input)

    cacheOidcConfigInput(input)

    expect(readAuthorizationDecision(origin)).toBe('granted')
  })

  it('drops the cache and grants when the entry is emptied', () => {
    window.localStorage.setItem(OIDC_CONFIG_STORAGE_KEY, input)

    cacheOidcConfigInput('')

    expect(readCachedOidcConfigInput()).toBe('')
    expect(readAuthorizationDecision(origin)).toBeUndefined()
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

describe('blocked storage', () => {
  let localStorageSpy: MockInstance | undefined

  beforeEach(() => {
    localStorageSpy = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new DOMException('Storage is blocked', 'SecurityError')
      })
  })

  afterEach(() => {
    localStorageSpy?.mockRestore()
  })

  it('reads an empty entry instead of throwing', () => {
    expect(readCachedOidcConfigInput()).toBe('')
    expect(readCachedOidcConfig()).toBeUndefined()
  })

  it('does not throw when caching or clearing an entry', () => {
    expect(() => cacheOidcConfigInput(JSON.stringify(settings))).not.toThrow()
    expect(() => cacheOidcConfigInput('')).not.toThrow()
  })
})

describe('parseOidcConfig optional fields', () => {
  it('keeps string optional fields and drops non-string ones', () => {
    const input = JSON.stringify({
      ...settings,
      grantType: 'implicit',
      authorizationEndpoint: 42,
      endSessionEndpoint: 'https://idp.example.com/logout',
    })
    expect(parseOidcConfig(input)).toEqual({
      ...settings,
      grantType: 'implicit',
      authorizationEndpoint: undefined,
      endSessionEndpoint: 'https://idp.example.com/logout',
    })
  })

  it('rejects arrays', () => {
    expect(parseOidcConfig('[1, 2]')).toBeUndefined()
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

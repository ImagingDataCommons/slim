import { isSafeReturnUrl } from '../OidcManager'

describe('isSafeReturnUrl', () => {
  const originalLocation = window.location

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'https://example.com',
      },
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('accepts same-origin relative paths', () => {
    expect(isSafeReturnUrl('/studies/1.2.3')).toBe(true)
    expect(isSafeReturnUrl('/studies/1.2.3?state=abc')).toBe(true)
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(isSafeReturnUrl('https://evil.example/phish')).toBe(false)
    expect(isSafeReturnUrl('//evil.example/phish')).toBe(false)
    expect(isSafeReturnUrl('https://example.com/studies/1')).toBe(false)
  })
})

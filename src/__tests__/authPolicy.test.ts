import {
  clearAuthorizationDecisions,
  getOrigin,
  isSecureOrigin,
  readAuthorizationDecision,
  writeAuthorizationDecision,
} from '../utils/authPolicy'

const DAY_MS = 24 * 60 * 60 * 1000

describe('authPolicy - origin resolution', () => {
  it('resolves the origin of an absolute DICOMweb URL', () => {
    expect(getOrigin('https://example.test/dicomWeb/studies')).toBe(
      'https://example.test',
    )
  })

  it('resolves a relative path against the Slim origin', () => {
    // `servers[].path` configurations are same-origin by construction.
    expect(getOrigin('/dicomweb')).toBe(window.location.origin)
  })

  it('returns undefined for an unparseable URL', () => {
    expect(getOrigin('http://[unclosed')).toBeUndefined()
  })
})

describe('authPolicy - secure origins', () => {
  it('accepts HTTPS origins', () => {
    expect(isSecureOrigin('https://example.test')).toBe(true)
  })

  it('accepts loopback origins, which browsers treat as secure contexts', () => {
    expect(isSecureOrigin('http://localhost:8080')).toBe(true)
    expect(isSecureOrigin('http://127.0.0.1:8042')).toBe(true)
    expect(isSecureOrigin('http://dev.localhost')).toBe(true)
  })

  it('rejects plain HTTP on a routable host', () => {
    expect(isSecureOrigin('http://dicom.intranet.example')).toBe(false)
    expect(isSecureOrigin('http://192.168.1.10:8080')).toBe(false)
  })

  it('rejects an unparseable origin', () => {
    expect(isSecureOrigin('not-a-url')).toBe(false)
  })
})

describe('authPolicy - remembered decisions', () => {
  beforeEach(() => {
    clearAuthorizationDecisions()
  })

  it('returns undefined for an origin that was never decided', () => {
    expect(readAuthorizationDecision('https://unknown.test')).toBeUndefined()
  })

  it('remembers a grant and a denial independently per origin', () => {
    writeAuthorizationDecision('https://yes.test', 'granted')
    writeAuthorizationDecision('https://no.test', 'denied')

    expect(readAuthorizationDecision('https://yes.test')).toBe('granted')
    expect(readAuthorizationDecision('https://no.test')).toBe('denied')
  })

  it('expires a grant so a stale approval cannot act for the next user', () => {
    const now = 1_000_000_000_000
    writeAuthorizationDecision('https://yes.test', 'granted', now)

    expect(readAuthorizationDecision('https://yes.test', now + DAY_MS)).toBe(
      'granted',
    )
    expect(
      readAuthorizationDecision('https://yes.test', now + 31 * DAY_MS),
    ).toBeUndefined()
  })

  it('keeps a denial indefinitely', () => {
    const now = 1_000_000_000_000
    writeAuthorizationDecision('https://no.test', 'denied', now)

    // Forgetting a denial would silently widen disclosure; forgetting a grant
    // only costs a prompt.
    expect(
      readAuthorizationDecision('https://no.test', now + 3650 * DAY_MS),
    ).toBe('denied')
  })

  it('overwrites an earlier decision for the same origin', () => {
    writeAuthorizationDecision('https://flip.test', 'denied')
    writeAuthorizationDecision('https://flip.test', 'granted')

    expect(readAuthorizationDecision('https://flip.test')).toBe('granted')
  })

  it('forgets every decision when cleared', () => {
    writeAuthorizationDecision('https://yes.test', 'granted')
    clearAuthorizationDecisions()

    expect(readAuthorizationDecision('https://yes.test')).toBeUndefined()
  })

  it('honours a decision pre-seeded by an automation script', () => {
    /**
     * Contract relied on by headless test harnesses, which seed this before the
     * app loads so an unattended run is never blocked by the consent prompt.
     * Documented in docs/CONFIGURATION.md — keep the key and shape stable.
     */
    window.localStorage.setItem(
      'slim_authorization_policy',
      JSON.stringify({
        'https://archive.test': { decision: 'granted' },
        'https://untrusted.test': { decision: 'denied' },
      }),
    )

    expect(readAuthorizationDecision('https://archive.test')).toBe('granted')
    expect(readAuthorizationDecision('https://untrusted.test')).toBe('denied')
  })

  it('never expires a pre-seeded grant that omits an expiry', () => {
    // A long-lived browser profile must not start prompting mid-campaign.
    window.localStorage.setItem(
      'slim_authorization_policy',
      JSON.stringify({ 'https://archive.test': { decision: 'granted' } }),
    )

    expect(readAuthorizationDecision('https://archive.test', 1e15)).toBe(
      'granted',
    )
  })

  it('ignores a corrupted storage entry rather than throwing', () => {
    window.localStorage.setItem('slim_authorization_policy', 'not json')

    expect(readAuthorizationDecision('https://yes.test')).toBeUndefined()
  })

  it('ignores an entry whose decision is not a recognised value', () => {
    window.localStorage.setItem(
      'slim_authorization_policy',
      JSON.stringify({ 'https://yes.test': { decision: 'maybe' } }),
    )

    expect(readAuthorizationDecision('https://yes.test')).toBeUndefined()
  })
})

import { webcrypto } from 'node:crypto'
import { OidcClient, SigninState } from 'oidc-client-ts'

import { installPkceFallback } from '../pkce'
import { pkceChallenge } from '../softwareCrypto'

const originalCreate = SigninState.create

const STATE_ARGS = {
  authority: 'https://idp.example.com',
  client_id: 'slim',
  redirect_uri: 'http://slim.internal/',
  scope: 'openid',
}

/** What an `http://` page sees: random values, but no `crypto.subtle` */
const hideSubtleCrypto = (): void => {
  vi.stubGlobal('crypto', {
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  })
}

afterEach(() => {
  SigninState.create = originalCreate
  vi.unstubAllGlobals()
})

describe('installPkceFallback', () => {
  it('leaves the library alone where Web Crypto is available', () => {
    installPkceFallback(webcrypto.subtle as SubtleCrypto)
    expect(SigninState.create).toBe(originalCreate)
  })

  it('installs once', () => {
    installPkceFallback(undefined)
    const installed = SigninState.create
    installPkceFallback(undefined)
    expect(SigninState.create).toBe(installed)
  })

  describe('without Web Crypto', () => {
    beforeEach(() => {
      hideSubtleCrypto()
      installPkceFallback()
    })

    it('generates a verifier and its S256 challenge', async () => {
      const state = await SigninState.create({
        ...STATE_ARGS,
        code_verifier: true,
      })
      expect(state.code_verifier).toMatch(/^[\w-]{43}$/)
      expect(state.code_challenge).toBe(
        pkceChallenge(state.code_verifier ?? ''),
      )
      expect(state.client_id).toBe('slim')
    })

    it('restores the stored verifier after the redirect', async () => {
      const state = await SigninState.create({
        ...STATE_ARGS,
        code_verifier: true,
      })
      const restored = await SigninState.fromStorageString(
        state.toStorageString(),
      )
      expect(restored.code_verifier).toBe(state.code_verifier)
      expect(restored.code_challenge).toBe(state.code_challenge)
    })

    it('creates no challenge when PKCE is off', async () => {
      const state = await SigninState.create({
        ...STATE_ARGS,
        code_verifier: false,
      })
      expect(state.code_verifier).toBeUndefined()
      expect(state.code_challenge).toBeUndefined()
    })

    it('lets the code flow build its authorization request', async () => {
      const client = new OidcClient({
        ...STATE_ARGS,
        metadata: {
          issuer: STATE_ARGS.authority,
          authorization_endpoint: `${STATE_ARGS.authority}/authorize`,
        },
      })
      const request = await client.createSigninRequest({})
      const url = new URL(request.url)
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('code_challenge')).toBe(
        request.state.code_challenge,
      )
    })
  })
})

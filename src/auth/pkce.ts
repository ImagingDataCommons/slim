import { SigninState } from 'oidc-client-ts'

type CreateSigninState = typeof SigninState.create

const fallbacks = new WeakSet<CreateSigninState>()

/** 32 random bytes give the 43-character verifier RFC 7636 recommends */
const VERIFIER_BYTES = 32

/**
 * oidc-client-ts derives the PKCE challenge with `crypto.subtle`, which
 * browsers hide on plain-HTTP pages, so the code flow could not start there.
 * Without Web Crypto, compute the verifier and challenge in JavaScript.
 */
export function installPkceFallback(
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): void {
  if (subtle !== undefined || fallbacks.has(SigninState.create)) return
  const create = SigninState.create.bind(SigninState)
  const createWithFallback: CreateSigninState = async (args) => {
    if (
      args.code_verifier === undefined ||
      args.code_verifier === false ||
      args.code_verifier === ''
    ) {
      return await create(args)
    }
    const { bytesToBase64Url, pkceChallenge } = await import('./softwareCrypto')
    const codeVerifier =
      args.code_verifier === true
        ? bytesToBase64Url(
            globalThis.crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)),
          )
        : args.code_verifier
    const state = await create({ ...args, code_verifier: undefined })
    return Object.assign(state, {
      code_verifier: codeVerifier,
      code_challenge: pkceChallenge(codeVerifier),
    })
  }
  fallbacks.add(createWithFallback)
  SigninState.create = createWithFallback
}

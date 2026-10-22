import { webcrypto } from 'node:crypto'

import type { HashName, SignatureScheme } from '../idTokenCrypto'
import { pkceChallenge, softwareIdTokenCrypto } from '../softwareCrypto'

const { subtle } = webcrypto as unknown as Crypto

const bytes = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(text, (char) => char.charCodeAt(0))

const DATA = bytes('header.payload')

async function rsaKeyPair(hash: HashName): Promise<CryptoKeyPair> {
  return await subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash,
    },
    true,
    ['sign', 'verify'],
  )
}

async function ecKeyPair(
  namedCurve: 'P-256' | 'P-384',
): Promise<CryptoKeyPair> {
  return await subtle.generateKey({ name: 'ECDSA', namedCurve }, true, [
    'sign',
    'verify',
  ])
}

async function sign(
  scheme: SignatureScheme,
  privateKey: CryptoKey,
  data: Uint8Array<ArrayBuffer> = DATA,
): Promise<Uint8Array<ArrayBuffer>> {
  const params =
    scheme.kty === 'RSA'
      ? { name: 'RSASSA-PKCS1-v1_5' }
      : { name: 'ECDSA', hash: scheme.hash }
  return new Uint8Array(await subtle.sign(params, privateKey, data))
}

describe('softwareIdTokenCrypto.digest', () => {
  it.each<HashName>([
    'SHA-256',
    'SHA-384',
    'SHA-512',
  ])('matches Web Crypto for %s', async (hash) => {
    const expected = new Uint8Array(await subtle.digest(hash, DATA))
    expect(await softwareIdTokenCrypto.digest(hash, DATA)).toEqual(expected)
  })
})

describe('softwareIdTokenCrypto.verify with RSA', () => {
  it.each<HashName>([
    'SHA-256',
    'SHA-384',
    'SHA-512',
  ])('accepts a valid %s signature and rejects tampering', async (hash) => {
    const scheme: SignatureScheme = { kty: 'RSA', hash }
    const { publicKey, privateKey } = await rsaKeyPair(hash)
    const jwk = await subtle.exportKey('jwk', publicKey)
    const signature = await sign(scheme, privateKey)

    expect(
      await softwareIdTokenCrypto.verify(scheme, jwk, signature, DATA),
    ).toBe(true)
    expect(
      await softwareIdTokenCrypto.verify(
        scheme,
        jwk,
        signature,
        bytes('header.forged'),
      ),
    ).toBe(false)
    const flipped = signature.slice()
    flipped[10] ^= 1
    expect(await softwareIdTokenCrypto.verify(scheme, jwk, flipped, DATA)).toBe(
      false,
    )
  })

  it('rejects a signature made with another hash', async () => {
    const { publicKey, privateKey } = await rsaKeyPair('SHA-256')
    const jwk = await subtle.exportKey('jwk', publicKey)
    const signature = await sign({ kty: 'RSA', hash: 'SHA-256' }, privateKey)
    expect(
      await softwareIdTokenCrypto.verify(
        { kty: 'RSA', hash: 'SHA-384' },
        jwk,
        signature,
        DATA,
      ),
    ).toBe(false)
  })

  it('rejects a truncated signature or a key without a modulus', async () => {
    const scheme: SignatureScheme = { kty: 'RSA', hash: 'SHA-256' }
    const { publicKey, privateKey } = await rsaKeyPair('SHA-256')
    const jwk = await subtle.exportKey('jwk', publicKey)
    const signature = await sign(scheme, privateKey)
    expect(
      await softwareIdTokenCrypto.verify(scheme, jwk, signature.slice(1), DATA),
    ).toBe(false)
    expect(
      await softwareIdTokenCrypto.verify(
        scheme,
        { ...jwk, n: undefined },
        signature,
        DATA,
      ),
    ).toBe(false)
  })
})

describe('softwareIdTokenCrypto.verify with ECDSA', () => {
  it.each([
    ['P-256', 'SHA-256'],
    ['P-384', 'SHA-384'],
  ] as const)('accepts a valid %s signature and rejects tampering', async (namedCurve, hash) => {
    const scheme: SignatureScheme = { kty: 'EC', namedCurve, hash }
    const { publicKey, privateKey } = await ecKeyPair(namedCurve)
    const jwk = await subtle.exportKey('jwk', publicKey)

    /** Web Crypto does not normalize `s`, so this covers high-S too */
    for (let attempt = 0; attempt < 8; attempt++) {
      const signature = await sign(scheme, privateKey)
      expect(
        await softwareIdTokenCrypto.verify(scheme, jwk, signature, DATA),
      ).toBe(true)
    }
    const signature = await sign(scheme, privateKey)
    expect(
      await softwareIdTokenCrypto.verify(
        scheme,
        jwk,
        signature,
        bytes('header.forged'),
      ),
    ).toBe(false)
  })

  it('rejects a key on another curve or a malformed point', async () => {
    const scheme: SignatureScheme = {
      kty: 'EC',
      namedCurve: 'P-256',
      hash: 'SHA-256',
    }
    const { publicKey, privateKey } = await ecKeyPair('P-256')
    const jwk = await subtle.exportKey('jwk', publicKey)
    const signature = await sign(scheme, privateKey)
    expect(
      await softwareIdTokenCrypto.verify(
        scheme,
        { ...jwk, crv: 'P-384' },
        signature,
        DATA,
      ),
    ).toBe(false)
    expect(
      await softwareIdTokenCrypto.verify(
        scheme,
        { ...jwk, y: jwk.x },
        signature,
        DATA,
      ),
    ).toBe(false)
  })
})

describe('pkceChallenge', () => {
  it('matches the RFC 7636 example', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})

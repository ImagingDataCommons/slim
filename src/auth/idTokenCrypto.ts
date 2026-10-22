import { derFromX5cCert, spkiFromX509Der } from './x509'

export type HashName = 'SHA-256' | 'SHA-384' | 'SHA-512'

/** JWS signature schemes accepted for ID tokens */
export type SignatureScheme =
  | { kty: 'RSA'; hash: HashName; padding?: 'PKCS1' | 'PSS' }
  | {
      kty: 'EC'
      namedCurve: 'P-256' | 'P-384' | 'P-521'
      hash: HashName
    }

/** The hashing and signature checks needed to verify an ID token */
export interface IdTokenCrypto {
  digest: (hash: HashName, data: Uint8Array<ArrayBuffer>) => Promise<Uint8Array>
  /** False for a bad signature or an unusable key, never throws for those */
  verify: (
    scheme: SignatureScheme,
    key: JsonWebKey,
    signature: Uint8Array<ArrayBuffer>,
    data: Uint8Array<ArrayBuffer>,
  ) => Promise<boolean>
}

const importParams = (
  scheme: SignatureScheme,
): RsaHashedImportParams | EcKeyImportParams => {
  if (scheme.kty === 'EC') {
    return { name: 'ECDSA', namedCurve: scheme.namedCurve }
  }
  if (scheme.padding === 'PSS') {
    return { name: 'RSA-PSS', hash: scheme.hash }
  }
  return { name: 'RSASSA-PKCS1-v1_5', hash: scheme.hash }
}

const verifyParams = (
  scheme: SignatureScheme,
): Algorithm | EcdsaParams | RsaPssParams => {
  if (scheme.kty === 'EC') {
    return { name: 'ECDSA', hash: scheme.hash }
  }
  if (scheme.padding === 'PSS') {
    const saltLength =
      scheme.hash === 'SHA-256' ? 32 : scheme.hash === 'SHA-384' ? 48 : 64
    return { name: 'RSA-PSS', saltLength }
  }
  return { name: 'RSASSA-PKCS1-v1_5' }
}

const hasJwkMaterial = (key: JsonWebKey): boolean =>
  (key.kty === 'RSA' && key.n !== undefined && key.e !== undefined) ||
  (key.kty === 'EC' &&
    key.crv !== undefined &&
    key.x !== undefined &&
    key.y !== undefined)

async function importVerifyKey(
  subtle: SubtleCrypto,
  scheme: SignatureScheme,
  key: JsonWebKey,
): Promise<CryptoKey> {
  const params = importParams(scheme)
  if (hasJwkMaterial(key)) {
    return await subtle.importKey('jwk', key, params, false, ['verify'])
  }
  const cert = (key as JsonWebKey & { x5c?: string[] }).x5c?.[0]
  if (typeof cert !== 'string' || cert === '') {
    throw new Error('Signing key has no usable material')
  }
  const spki = spkiFromX509Der(derFromX5cCert(cert))
  return await subtle.importKey(
    'spki',
    spki.buffer.slice(
      spki.byteOffset,
      spki.byteOffset + spki.byteLength,
    ) as ArrayBuffer,
    params,
    false,
    ['verify'],
  )
}

export function webIdTokenCrypto(subtle: SubtleCrypto): IdTokenCrypto {
  return {
    digest: async (hash, data) =>
      new Uint8Array(await subtle.digest(hash, data)),
    verify: async (scheme, key, signature, data) => {
      try {
        const cryptoKey = await importVerifyKey(subtle, scheme, key)
        return await subtle.verify(
          verifyParams(scheme),
          cryptoKey,
          signature,
          data,
        )
      } catch {
        return false
      }
    },
  }
}

/**
 * Web Crypto where the browser offers it. Browsers hide `crypto.subtle`
 * outside secure contexts (plain HTTP on a non-loopback host), so there the
 * JavaScript implementation is loaded instead.
 */
export async function loadIdTokenCrypto(
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<IdTokenCrypto> {
  if (subtle !== undefined) return webIdTokenCrypto(subtle)
  const { softwareIdTokenCrypto } = await import('./softwareCrypto')
  return softwareIdTokenCrypto
}

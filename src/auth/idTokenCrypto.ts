export type HashName = 'SHA-256' | 'SHA-384' | 'SHA-512'

/** JWS signature schemes accepted for ID tokens */
export type SignatureScheme =
  | { kty: 'RSA'; hash: HashName }
  | { kty: 'EC'; namedCurve: 'P-256' | 'P-384'; hash: HashName }

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
): RsaHashedImportParams | EcKeyImportParams =>
  scheme.kty === 'RSA'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: scheme.hash }
    : { name: 'ECDSA', namedCurve: scheme.namedCurve }

const verifyParams = (scheme: SignatureScheme): Algorithm | EcdsaParams =>
  scheme.kty === 'RSA'
    ? { name: 'RSASSA-PKCS1-v1_5' }
    : { name: 'ECDSA', hash: scheme.hash }

export function webIdTokenCrypto(subtle: SubtleCrypto): IdTokenCrypto {
  return {
    digest: async (hash, data) =>
      new Uint8Array(await subtle.digest(hash, data)),
    verify: async (scheme, key, signature, data) => {
      try {
        const cryptoKey = await subtle.importKey(
          'jwk',
          key,
          importParams(scheme),
          false,
          ['verify'],
        )
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

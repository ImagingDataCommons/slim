import { p256, p384 } from '@noble/curves/nist.js'
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js'

import type { HashName, IdTokenCrypto, SignatureScheme } from './idTokenCrypto'

/**
 * JavaScript stand-ins for the Web Crypto calls sign-in needs, for pages
 * served where browsers hide `crypto.subtle`. Only public-key verification
 * and hashing happen here; nothing secret is computed.
 */

const HASHES: Record<HashName, (data: Uint8Array) => Uint8Array> = {
  'SHA-256': sha256,
  'SHA-384': sha384,
  'SHA-512': sha512,
}

/** DER DigestInfo prefixes of EMSA-PKCS1-v1_5 (RFC 8017, section 9.2) */
const DIGEST_INFO_PREFIX: Record<HashName, readonly number[]> = {
  'SHA-256': [
    0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03,
    0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20,
  ],
  'SHA-384': [
    0x30, 0x41, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03,
    0x04, 0x02, 0x02, 0x05, 0x00, 0x04, 0x30,
  ],
  'SHA-512': [
    0x30, 0x51, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03,
    0x04, 0x02, 0x03, 0x05, 0x00, 0x04, 0x40,
  ],
}

const CURVES = {
  'P-256': { ecdsa: p256, size: 32 },
  'P-384': { ecdsa: p384, size: 48 },
} as const

export const base64UrlToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  )
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

export const bytesToBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')

const bytesToBigInt = (bytes: Uint8Array): bigint =>
  bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)

const bigIntToBytes = (value: bigint, length: number): Uint8Array => {
  const bytes = new Uint8Array(length)
  let rest = value
  for (let index = length - 1; index >= 0; index--) {
    bytes[index] = Number(rest & 0xffn)
    rest >>= 8n
  }
  return bytes
}

const modPow = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  let result = 1n
  let factor = base % modulus
  let rest = exponent
  while (rest > 0n) {
    if ((rest & 1n) === 1n) result = (result * factor) % modulus
    factor = (factor * factor) % modulus
    rest >>= 1n
  }
  return result
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, index) => byte === b[index])

/** RSASSA-PKCS1-v1_5 verification (RFC 8017, section 8.2.2) */
export function verifyRsaPkcs1(
  hash: HashName,
  key: JsonWebKey,
  signature: Uint8Array,
  data: Uint8Array,
): boolean {
  if (key.n === undefined || key.e === undefined) return false
  const modulusBytes = base64UrlToBytes(key.n)
  const modulus = bytesToBigInt(modulusBytes)
  const exponent = bytesToBigInt(base64UrlToBytes(key.e))
  const length = modulusBytes.length - (modulusBytes[0] === 0 ? 1 : 0)
  const digestInfo = [...DIGEST_INFO_PREFIX[hash], ...HASHES[hash](data)]
  if (
    modulus === 0n ||
    signature.length !== length ||
    length < digestInfo.length + 11
  ) {
    return false
  }
  const value = bytesToBigInt(signature)
  if (value >= modulus) return false
  const encoded = bigIntToBytes(modPow(value, exponent, modulus), length)
  const expected = new Uint8Array(length)
  expected[1] = 0x01
  expected.fill(0xff, 2, length - digestInfo.length - 1)
  expected.set(digestInfo, length - digestInfo.length)
  return bytesEqual(encoded, expected)
}

/** ECDSA verification of a JWS (raw `r || s`) signature */
export function verifyEcdsa(
  namedCurve: 'P-256' | 'P-384',
  hash: HashName,
  key: JsonWebKey,
  signature: Uint8Array,
  data: Uint8Array,
): boolean {
  const curve = CURVES[namedCurve]
  if (key.crv !== namedCurve || key.x === undefined || key.y === undefined) {
    return false
  }
  const x = base64UrlToBytes(key.x)
  const y = base64UrlToBytes(key.y)
  if (x.length !== curve.size || y.length !== curve.size) return false
  const publicKey = new Uint8Array(1 + 2 * curve.size)
  publicKey[0] = 0x04
  publicKey.set(x, 1)
  publicKey.set(y, 1 + curve.size)
  try {
    /** JWS signers do not normalize `s`, so high-S signatures are valid */
    return curve.ecdsa.verify(signature, HASHES[hash](data), publicKey, {
      prehash: false,
      lowS: false,
      format: 'compact',
    })
  } catch {
    return false
  }
}

export const softwareIdTokenCrypto: IdTokenCrypto = {
  digest: async (hash, data) => HASHES[hash](data),
  verify: async (scheme: SignatureScheme, key, signature, data) =>
    scheme.kty === 'RSA'
      ? verifyRsaPkcs1(scheme.hash, key, signature, data)
      : verifyEcdsa(scheme.namedCurve, scheme.hash, key, signature, data),
}

/** PKCE S256 challenge (RFC 7636): base64url(SHA-256(ASCII(verifier))) */
export function pkceChallenge(codeVerifier: string): string {
  const bytes = Uint8Array.from(codeVerifier, (char) => char.charCodeAt(0))
  return bytesToBase64Url(sha256(bytes))
}

/**
 * Minimal X.509 helpers so JWKS entries published only as `x5c` can be used
 * for ID token verification (Web Crypto imports SPKI; software needs n/e or x/y).
 */

const readLength = (
  bytes: Uint8Array,
  offset: number,
): { length: number; next: number } => {
  const first = bytes[offset]
  if (first === undefined) {
    throw new Error('Unexpected end of DER')
  }
  if (first < 0x80) {
    return { length: first, next: offset + 1 }
  }
  const count = first & 0x7f
  let length = 0
  let next = offset + 1
  for (let index = 0; index < count; index += 1) {
    const byte = bytes[next]
    if (byte === undefined) {
      throw new Error('Unexpected end of DER')
    }
    length = (length << 8) | byte
    next += 1
  }
  return { length, next }
}

interface DerNode {
  tag: number
  /** Inclusive start of the TLV header */
  header: number
  /** Exclusive end of the value */
  end: number
  /** Start of the value bytes */
  start: number
}

const readNode = (bytes: Uint8Array, offset: number): DerNode => {
  const tag = bytes[offset]
  if (tag === undefined) {
    throw new Error('Unexpected end of DER')
  }
  const { length, next } = readLength(bytes, offset + 1)
  return { tag, header: offset, start: next, end: next + length }
}

const readSequenceChildren = (
  bytes: Uint8Array,
  sequence: DerNode,
): DerNode[] => {
  if (sequence.tag !== 0x30) {
    throw new Error('Expected SEQUENCE')
  }
  const children: DerNode[] = []
  let offset = sequence.start
  while (offset < sequence.end) {
    const child = readNode(bytes, offset)
    children.push(child)
    offset = child.end
  }
  return children
}

/**
 * SubjectPublicKeyInfo TLV bytes from a DER-encoded X.509 certificate.
 *
 * @throws Error when the certificate shape is not recognized
 */
export const spkiFromX509Der = (der: Uint8Array): Uint8Array => {
  const certificate = readNode(der, 0)
  const [tbs] = readSequenceChildren(der, certificate)
  if (tbs === undefined) {
    throw new Error('Certificate has no TBSCertificate')
  }
  const tbsChildren = readSequenceChildren(der, tbs)
  let index = 0
  if (tbsChildren[0]?.tag === 0xa0) {
    index = 1
  }
  /** serial, signature, issuer, validity, subject, subjectPublicKeyInfo */
  const spki = tbsChildren[index + 5]
  if (spki === undefined || spki.tag !== 0x30) {
    throw new Error('Certificate has no subjectPublicKeyInfo')
  }
  return der.subarray(spki.header, spki.end)
}

export const derFromX5cCert = (certBase64: string): Uint8Array => {
  const binary = atob(certBase64.replace(/\s+/g, ''))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const bytesToBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/[=]+$/, '')

/** Strip leading zero bytes that DER INTEGER uses for sign extension */
const unsignedInteger = (bytes: Uint8Array): Uint8Array => {
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start += 1
  }
  return bytes.subarray(start)
}

const EC_CURVE_OIDS: Record<string, string> = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
}

const readOid = (bytes: Uint8Array, node: DerNode): string => {
  if (node.tag !== 0x06) {
    throw new Error('Expected OID')
  }
  const value = bytes.subarray(node.start, node.end)
  if (value.length === 0) {
    throw new Error('Empty OID')
  }
  const first = value[0] ?? 0
  const parts = [Math.floor(first / 40), first % 40]
  let current = 0
  for (let index = 1; index < value.length; index += 1) {
    const byte = value[index] ?? 0
    current = (current << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) {
      parts.push(current)
      current = 0
    }
  }
  return parts.join('.')
}

/**
 * Public JWK material from the first `x5c` certificate, or undefined when the
 * SPKI cannot be decoded to RSA or EC coordinates.
 */
export const jwkFromX5c = (certBase64: string): JsonWebKey | undefined => {
  try {
    const der = derFromX5cCert(certBase64)
    const spkiBytes = spkiFromX509Der(der)
    const spki = readNode(spkiBytes, 0)
    const [algorithm, subjectPublicKey] = readSequenceChildren(spkiBytes, spki)
    if (algorithm === undefined || subjectPublicKey === undefined) {
      return undefined
    }
    if (subjectPublicKey.tag !== 0x03) {
      return undefined
    }
    /** BIT STRING: first byte is unused-bits count (0 for keys) */
    const bitString = spkiBytes.subarray(
      subjectPublicKey.start + 1,
      subjectPublicKey.end,
    )
    const algorithmChildren = readSequenceChildren(spkiBytes, algorithm)
    const algorithmOid = algorithmChildren[0]
    if (algorithmOid === undefined) {
      return undefined
    }
    const oid = readOid(spkiBytes, algorithmOid)

    /** rsaEncryption */
    if (oid === '1.2.840.113549.1.1.1') {
      const rsaKey = readNode(bitString, 0)
      const [modulus, exponent] = readSequenceChildren(bitString, rsaKey)
      if (modulus === undefined || exponent === undefined) {
        return undefined
      }
      if (modulus.tag !== 0x02 || exponent.tag !== 0x02) {
        return undefined
      }
      return {
        kty: 'RSA',
        n: bytesToBase64Url(
          unsignedInteger(bitString.subarray(modulus.start, modulus.end)),
        ),
        e: bytesToBase64Url(
          unsignedInteger(bitString.subarray(exponent.start, exponent.end)),
        ),
      }
    }

    /** id-ecPublicKey */
    if (oid === '1.2.840.10045.2.1') {
      const curveOid = algorithmChildren[1]
      if (curveOid === undefined) {
        return undefined
      }
      const crv = EC_CURVE_OIDS[readOid(spkiBytes, curveOid)]
      if (crv === undefined || bitString[0] !== 0x04) {
        return undefined
      }
      const coordinateLength = (bitString.length - 1) / 2
      if (!Number.isInteger(coordinateLength) || coordinateLength < 1) {
        return undefined
      }
      return {
        kty: 'EC',
        crv,
        x: bytesToBase64Url(bitString.subarray(1, 1 + coordinateLength)),
        y: bytesToBase64Url(bitString.subarray(1 + coordinateLength)),
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

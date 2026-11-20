/** Decode a base64url string to raw bytes (RFC 4648 §5). */
export const base64UrlToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  )
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

/** Encode bytes as an unpadded base64url string (RFC 4648 §5). */
export const bytesToBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/[=]+$/, '')

/** Decode base64url to a binary string (each char is one byte). */
export const base64UrlToBinary = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  )
  return atob(padded)
}

/** Decode base64url that encodes UTF-8 text (JWT JSON parts). */
export const base64UrlToUtf8 = (input: string): string => {
  const percentEncoded = Array.from(
    base64UrlToBinary(input),
    (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
  ).join('')
  return decodeURIComponent(percentEncoded)
}

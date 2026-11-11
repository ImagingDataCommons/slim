import { describe, expect, it } from 'vitest'

import {
  base64UrlToBinary,
  base64UrlToBytes,
  base64UrlToUtf8,
  bytesToBase64Url,
} from '../base64Url'

describe('base64Url', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([1, 2, 255, 0])
    expect([...base64UrlToBytes(bytesToBase64Url(bytes))]).toEqual([...bytes])
  })

  it('decodes utf-8 jwt-style payloads', () => {
    const encoded = bytesToBase64Url(
      new TextEncoder().encode(JSON.stringify({ hello: 'café' })),
    )
    expect(JSON.parse(base64UrlToUtf8(encoded))).toEqual({ hello: 'café' })
    expect(base64UrlToBinary(encoded).length).toBeGreaterThan(0)
  })
})

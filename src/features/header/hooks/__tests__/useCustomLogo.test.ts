import { renderHook, waitFor } from '@testing-library/react'

import { useCustomLogo } from '../useCustomLogo'

const LOGO = '<svg><rect width="1" height="1"/></svg>'

function respond(body: string, init: ResponseInit = {}): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, {
      headers: { 'content-type': 'image/svg+xml' },
      ...init,
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCustomLogo', () => {
  it('returns the URL of a usable logo', async () => {
    respond(LOGO)
    const { result } = renderHook(() => useCustomLogo('/logo.svg'))
    await waitFor(() => expect(result.current).toBe('/logo.svg'))
  })

  it('keeps the built-in logo for the empty placeholder', async () => {
    respond('<svg viewBox="0 0 1 1"></svg>')
    const { result } = renderHook(() => useCustomLogo('/logo.svg'))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await Promise.resolve()
    expect(result.current).toBeUndefined()
  })

  it('keeps the built-in logo when the file is missing', async () => {
    respond('', { status: 404 })
    const { result } = renderHook(() => useCustomLogo('/logo.svg'))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await Promise.resolve()
    expect(result.current).toBeUndefined()
  })

  it('keeps the built-in logo when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    const { result } = renderHook(() => useCustomLogo('/logo.svg'))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await Promise.resolve()
    expect(result.current).toBeUndefined()
  })

  it('aborts the request on unmount', () => {
    respond(LOGO)
    const { unmount } = renderHook(() => useCustomLogo('/logo.svg'))
    const init = vi.mocked(fetch).mock.calls[0][1]
    unmount()
    expect(init?.signal?.aborted).toBe(true)
  })
})

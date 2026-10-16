import type { Mock, MockInstance } from 'vitest'
import { downloadTextFile } from '../download'

describe('downloadTextFile', () => {
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  let createObjectURL: Mock
  let revokeObjectURL: Mock
  let click: MockInstance

  beforeEach(() => {
    vi.useFakeTimers()
    createObjectURL = vi.fn(() => 'blob:mock')
    revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(document.body.contains(this)).toBe(true)
        expect(this.download).toBe('config.js')
        expect(this.href).toBe('blob:mock')
      })
  })

  afterEach(() => {
    click.mockRestore()
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    vi.useRealTimers()
  })

  it('clicks an attached anchor and removes it', () => {
    downloadTextFile('config.js', 'window.config = {}', 'text/javascript')
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download]')).toBeNull()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/javascript')
  })

  it('revokes the object URL asynchronously', () => {
    downloadTextFile('config.js', 'text')
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})

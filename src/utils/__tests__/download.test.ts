import { downloadTextFile } from '../download'

describe('downloadTextFile', () => {
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  let createObjectURL: jest.Mock
  let revokeObjectURL: jest.Mock
  let click: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    createObjectURL = jest.fn(() => 'blob:mock')
    revokeObjectURL = jest.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    click = jest
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
    jest.useRealTimers()
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
    jest.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})

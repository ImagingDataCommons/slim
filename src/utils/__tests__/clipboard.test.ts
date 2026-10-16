import { writeClipboardText } from '../clipboard'

describe('writeClipboardText', () => {
  it('resolves true once the text is written', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await expect(writeClipboardText({ writeText }, 'hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('resolves false when the write is rejected', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    await expect(writeClipboardText({ writeText }, 'hello')).resolves.toBe(
      false,
    )
  })

  it('resolves false without a clipboard', async () => {
    await expect(writeClipboardText(undefined, 'hello')).resolves.toBe(false)
  })
})

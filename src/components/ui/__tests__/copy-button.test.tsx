import { act, fireEvent, render, screen } from '@testing-library/react'

import { CopyButton } from '../copy-button'

describe('CopyButton', () => {
  const writeText = vi.fn<(...args: [string]) => Promise<void>>()

  beforeEach(() => {
    vi.useFakeTimers()
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('copies the text and confirms until the reset delay', async () => {
    render(<CopyButton text="1.2.3" label="Copy UID" resetAfterMs={1000} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy UID' }))
    })
    expect(writeText).toHaveBeenCalledWith('1.2.3')
    expect(screen.getByRole('button', { name: 'Copied' })).toHaveClass(
      'text-success',
    )
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('button', { name: 'Copy UID' })).toBeInTheDocument()
  })

  it('reads lazy text at click time', async () => {
    let value = 'first'
    render(<CopyButton text={() => value} />)
    value = 'second'
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    })
    expect(writeText).toHaveBeenCalledWith('second')
  })

  it('keeps an explicit accessible name', async () => {
    render(<CopyButton text="x" aria-label="Copy server URL" />)
    expect(
      screen.getByRole('button', { name: 'Copy server URL' }),
    ).toBeInTheDocument()
  })
})

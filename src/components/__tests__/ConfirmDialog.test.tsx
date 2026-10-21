import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { showConfirmDialog } from '../ConfirmDialog'

describe('showConfirmDialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('resolves confirm when the confirm button is clicked', async () => {
    const result = showConfirmDialog({ title: 'Send token?' })
    const confirm = await screen.findByRole('button', { name: 'Confirm' })
    await act(async () => {
      confirm.click()
    })
    await expect(result).resolves.toBe('confirm')
  })

  it('resolves cancel when the cancel button is clicked', async () => {
    const result = showConfirmDialog({ title: 'Send token?' })
    const cancel = await screen.findByRole('button', { name: 'Cancel' })
    await act(async () => {
      cancel.click()
    })
    await expect(result).resolves.toBe('cancel')
  })

  it('shows a dialog opened meanwhile after the first is answered', async () => {
    const first = showConfirmDialog({ title: 'First origin?' })
    await screen.findByRole('heading', { name: 'First origin?' })
    const second = showConfirmDialog({ title: 'Second origin?' })
    expect(screen.queryByRole('heading', { name: 'Second origin?' })).toBeNull()

    await act(async () => {
      screen.getByRole('button', { name: 'Cancel' }).click()
    })
    await expect(first).resolves.toBe('cancel')

    await screen.findByRole('heading', { name: 'Second origin?' })
    await act(async () => {
      screen.getByRole('button', { name: 'Confirm' }).click()
    })
    await expect(second).resolves.toBe('confirm')
  })

  it('reports a dialog that fails to render and still shows the next one', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): never {
      throw new Error('cannot render')
    }
    const broken = showConfirmDialog({
      title: 'Broken origin?',
      description: <Broken />,
    })
    const next = showConfirmDialog({ title: 'Next origin?' })

    await expect(broken).resolves.toBe('failed')
    await screen.findByRole('heading', { name: 'Next origin?' })
    await act(async () => {
      screen.getByRole('button', { name: 'Confirm' }).click()
    })
    await expect(next).resolves.toBe('confirm')
    logError.mockRestore()
  })

  it('does not take a click outside as an answer, but Escape cancels', async () => {
    let settled: string | undefined
    const result = showConfirmDialog({ title: 'Send token?' }).then(
      (choice) => {
        settled = choice
        return choice
      },
    )
    const dialog = await screen
      .findByRole('alertdialog')
      .catch(async () => await screen.findByRole('dialog'))

    /** Radix starts listening for outside presses on the next tick */
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    const overlay = document.querySelector('.bg-scrim\\/36')
    expect(overlay).not.toBeNull()
    fireEvent.pointerDown(overlay as Element, {
      button: 0,
      pointerType: 'mouse',
    })
    fireEvent.pointerUp(overlay as Element, { button: 0, pointerType: 'mouse' })
    fireEvent.click(overlay as Element)
    await act(async () => {
      await Promise.resolve()
    })
    expect(settled).toBeUndefined()
    expect(dialog).toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await expect(result).resolves.toBe('cancel')
  })
})

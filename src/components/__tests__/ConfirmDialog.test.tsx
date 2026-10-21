import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

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
})

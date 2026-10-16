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

  it('resolves the prior dialog as superseded when a new one opens', async () => {
    const first = showConfirmDialog({ title: 'First origin?' })
    await screen.findByRole('heading', { name: 'First origin?' })
    const second = showConfirmDialog({ title: 'Second origin?' })
    await expect(first).resolves.toBe('superseded')
    const confirm = await screen.findByRole('button', { name: 'Confirm' })
    await act(async () => {
      confirm.click()
    })
    await expect(second).resolves.toBe('confirm')
  })
})

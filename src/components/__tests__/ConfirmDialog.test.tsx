import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { showConfirmDialog } from '../ConfirmDialog'

describe('showConfirmDialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('resolves confirm when the confirm button is clicked', async () => {
    const result = showConfirmDialog({ title: 'Send token?' })
    await act(async () => {
      document.querySelector<HTMLButtonElement>('button:last-of-type')?.click()
    })
    await expect(result).resolves.toBe('confirm')
  })

  it('resolves cancel when the cancel button is clicked', async () => {
    const result = showConfirmDialog({ title: 'Send token?' })
    await act(async () => {
      document.querySelector<HTMLButtonElement>('button')?.click()
    })
    await expect(result).resolves.toBe('cancel')
  })

  it('resolves the prior dialog as superseded when a new one opens', async () => {
    const first = showConfirmDialog({ title: 'First origin?' })
    const second = showConfirmDialog({ title: 'Second origin?' })
    await expect(first).resolves.toBe('superseded')
    await act(async () => {
      document.querySelector<HTMLButtonElement>('button:last-of-type')?.click()
    })
    await expect(second).resolves.toBe('confirm')
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  PREFERENCES_STORAGE_KEY,
  savePreferences,
} from '../../../preferences/utils/preferences'
import { ColumnsPicker } from '../ColumnsPicker'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

beforeEach(() => {
  window.localStorage.clear()
  savePreferences(DEFAULT_PREFERENCES)
})

describe('ColumnsPicker', () => {
  it('hides an eligible column when unchecked', () => {
    render(<ColumnsPicker tier="xl" hiddenColumnIds={[]} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose worklist columns' }),
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Accession #' }))
    expect(loadPreferences().worklistHiddenColumnIds).toEqual([
      'AccessionNumber',
    ])
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain(
      'AccessionNumber',
    )
  })

  it('does not allow turning off Patient name', () => {
    render(<ColumnsPicker tier="xl" hiddenColumnIds={[]} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose worklist columns' }),
    )
    const name = screen.getByRole('checkbox', { name: 'Patient name' })
    expect(name).toBeDisabled()
    expect(name).toBeChecked()
  })

  it('disables columns the current width cannot fit', () => {
    render(<ColumnsPicker tier="base" hiddenColumnIds={[]} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose worklist columns' }),
    )
    expect(screen.getByRole('checkbox', { name: 'Accession #' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Study date' })).toBeEnabled()
  })
})

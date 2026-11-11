import { afterEach, describe, expect, it, vi } from 'vitest'

import { showMatchingSeriesItems } from '../showSeriesItems'

type SetUpdate = (current: Set<string>) => Set<string>

afterEach(() => {
  vi.restoreAllMocks()
})

describe('showMatchingSeriesItems', () => {
  it('shows matching items and updates visibility', () => {
    const shown: string[] = []
    const show = vi.fn((id: string) => {
      shown.push(id)
    })
    let nextVisible: Set<string> | undefined
    const setVisible = vi.fn((update: SetUpdate) => {
      nextVisible = update(new Set(['keep']))
    })

    showMatchingSeriesItems({
      items: [
        { seriesInstanceUID: 's1', uid: 'a' },
        { seriesInstanceUID: 's2', uid: 'x' },
        { seriesInstanceUID: 's1', uid: 'b' },
      ],
      seriesInstanceUID: 's1',
      label: 'Test',
      getSeriesInstanceUID: (item) => item.seriesInstanceUID,
      getId: (item) => item.uid,
      show,
      setVisible,
    })

    expect(shown).toEqual(['a', 'b'])
    expect(setVisible).toHaveBeenCalledTimes(1)
    expect([...(nextVisible ?? [])]).toEqual(['keep', 'a', 'b'])
  })

  it('skips items and continues after a show failure', () => {
    const show = vi.fn((id: string) => {
      if (id === 'bad') throw new Error('boom')
    })
    let nextVisible: Set<string> | undefined
    const setVisible = vi.fn((update: SetUpdate) => {
      nextVisible = update(new Set())
    })

    showMatchingSeriesItems({
      items: [
        { seriesInstanceUID: 's1', uid: 'skip' },
        { seriesInstanceUID: 's1', uid: 'bad' },
        { seriesInstanceUID: 's1', uid: 'ok' },
      ],
      seriesInstanceUID: 's1',
      label: 'Test',
      getSeriesInstanceUID: (item) => item.seriesInstanceUID,
      getId: (item) => item.uid,
      show,
      setVisible,
      shouldSkip: (item) => item.uid === 'skip',
    })

    expect(show).toHaveBeenCalledTimes(2)
    expect(setVisible).toHaveBeenCalledTimes(1)
    expect([...(nextVisible ?? [])]).toEqual(['ok'])
  })

  it('does not update visibility when nothing was shown', () => {
    const setVisible = vi.fn()
    showMatchingSeriesItems({
      items: [{ seriesInstanceUID: 'other', uid: 'a' }],
      seriesInstanceUID: 's1',
      label: 'Test',
      getSeriesInstanceUID: (item) => item.seriesInstanceUID,
      getId: (item) => item.uid,
      show: vi.fn(),
      setVisible,
    })
    expect(setVisible).not.toHaveBeenCalled()
  })
})

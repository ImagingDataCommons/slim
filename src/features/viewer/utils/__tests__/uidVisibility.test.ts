import { describe, expect, it, vi } from 'vitest'

import { applyUidVisibility, mirrorDmvVisibility } from '../uidVisibility'

type SetUpdate = (current: Set<string>) => Set<string>

describe('applyUidVisibility', () => {
  it('shows and adds the uid', () => {
    const show = vi.fn()
    const hide = vi.fn()
    let nextVisible: Set<string> | undefined
    const setVisibleUIDs = vi.fn((update: SetUpdate) => {
      nextVisible = update(new Set(['a']))
    })

    applyUidVisibility({
      uid: 'b',
      isVisible: true,
      show,
      hide,
      setVisibleUIDs,
    })

    expect(show).toHaveBeenCalledWith('b')
    expect(hide).not.toHaveBeenCalled()
    expect([...(nextVisible ?? [])]).toEqual(['a', 'b'])
  })

  it('hides and removes the uid', () => {
    const show = vi.fn()
    const hide = vi.fn()
    let nextVisible: Set<string> | undefined
    const setVisibleUIDs = vi.fn((update: SetUpdate) => {
      nextVisible = update(new Set(['a', 'b']))
    })

    applyUidVisibility({
      uid: 'b',
      isVisible: false,
      show,
      hide,
      setVisibleUIDs,
    })

    expect(hide).toHaveBeenCalledWith('b')
    expect(show).not.toHaveBeenCalled()
    expect([...(nextVisible ?? [])]).toEqual(['a'])
  })
})

describe('mirrorDmvVisibility', () => {
  it('ignores incomplete payloads', () => {
    const setVisibleUIDs = vi.fn()
    mirrorDmvVisibility(setVisibleUIDs, null, true)
    mirrorDmvVisibility(setVisibleUIDs, 'a', null)
    expect(setVisibleUIDs).not.toHaveBeenCalled()
  })

  it('mirrors visibility into the set', () => {
    let nextVisible: Set<string> | undefined
    const setVisibleUIDs = vi.fn((update: SetUpdate) => {
      nextVisible = update(new Set())
    })
    mirrorDmvVisibility(setVisibleUIDs, 'a', true)
    expect(setVisibleUIDs).toHaveBeenCalledTimes(1)
    expect([...(nextVisible ?? [])]).toEqual(['a'])
  })
})

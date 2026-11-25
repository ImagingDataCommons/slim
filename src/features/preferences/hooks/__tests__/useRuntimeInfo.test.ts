import { renderHook } from '@testing-library/react'

import type { RuntimeInfo } from '../../utils/runtimeInfo'
import { useRuntimeInfo } from '../useRuntimeInfo'

const OVERRIDE: RuntimeInfo = {
  config: { mode: 'dark' },
  configName: 'test',
  dmvVersion: '1.0.0',
  browserLabel: 'Test browser',
  userAgent: 'test',
}

describe('useRuntimeInfo', () => {
  it('reads the environment once per mount', () => {
    const { result, rerender } = renderHook(() => useRuntimeInfo())
    const first = result.current
    expect(first.configName).toBe(import.meta.env.REACT_APP_CONFIG ?? 'local')
    expect(first.userAgent).toBe(navigator.userAgent)
    rerender()
    expect(result.current).toBe(first)
  })

  it('returns the override when given', () => {
    const { result } = renderHook(() => useRuntimeInfo(OVERRIDE))
    expect(result.current).toBe(OVERRIDE)
  })
})

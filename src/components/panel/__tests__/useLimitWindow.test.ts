import { act, renderHook } from '@testing-library/react'

import { type UseLimitWindowOptions, useLimitWindow } from '../useLimitWindow'

function setup(overrides: Partial<UseLimitWindowOptions> = {}) {
  const onCommit = jest.fn()
  const options: UseLimitWindowOptions = {
    initial: [10, 200],
    min: 0,
    max: 255,
    onCommit,
    ...overrides,
  }
  const hook = renderHook(
    (props: UseLimitWindowOptions) => useLimitWindow(props),
    { initialProps: options },
  )
  return { ...hook, onCommit, options }
}

describe('useLimitWindow', () => {
  it('has no window without two initial values', () => {
    expect(setup({ initial: undefined }).result.current.values).toBeUndefined()
    expect(setup({ initial: [3] }).result.current.values).toBeUndefined()
  })

  it('previews clamped values without committing', () => {
    const { result, onCommit } = setup()
    act(() => result.current.preview([-5, 300]))
    expect(result.current.values).toEqual([0, 255])
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('reports clamped preview values to onPreview only', () => {
    const onPreview = jest.fn()
    const { result, onCommit } = setup({ onPreview })
    act(() => result.current.preview([-5, 300]))
    expect(onPreview).toHaveBeenCalledWith([0, 255])
    act(() => result.current.commit([20, 100]))
    expect(onPreview).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith([20, 100])
  })

  it('commits clamped values', () => {
    const { result, onCommit } = setup()
    act(() => result.current.commit([20, 100]))
    expect(result.current.values).toEqual([20, 100])
    expect(onCommit).toHaveBeenCalledWith([20, 100])
  })

  it('keeps lower <= upper when one side is typed', () => {
    const { result, onCommit } = setup()
    act(() => result.current.commitUpper(40))
    expect(result.current.values).toEqual([10, 40])

    act(() => result.current.commitLower(250))
    const [lower, upper] = result.current.values ?? [1, 0]
    expect(lower).toBeLessThanOrEqual(upper)
    expect(onCommit).toHaveBeenLastCalledWith(result.current.values)
  })

  it('ignores typed values when there is no window', () => {
    const { result, onCommit } = setup({ initial: undefined })
    act(() => result.current.commitLower(5))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('restarts from the initial window when the reset key changes', () => {
    const { result, rerender, options } = setup({ resetKey: 'a' })
    act(() => result.current.preview([50, 60]))
    rerender({ ...options, initial: [1, 2], resetKey: 'b' })
    expect(result.current.values).toEqual([1, 2])
  })
})

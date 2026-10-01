import { debounce } from '../debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls once with the latest arguments after the wait (trailing)', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced(1)
    debounced(2)
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)
  })

  it('restarts the wait on every call', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced('a')
    vi.advanceTimersByTime(80)
    debounced('b')
    vi.advanceTimersByTime(80)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(20)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('with leading + trailing, a single call fires once', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 0, { leading: true, trailing: true })
    debounced('only')
    expect(fn).toHaveBeenCalledWith('only')
    vi.runAllTimers()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('with leading + trailing, a burst fires at both edges', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 0, { leading: true, trailing: true })
    debounced(1)
    debounced(2)
    debounced(3)
    expect(fn.mock.calls).toEqual([[1]])
    vi.runAllTimers()
    expect(fn.mock.calls).toEqual([[1], [3]])
    debounced(4)
    expect(fn.mock.calls).toEqual([[1], [3], [4]])
  })

  it('leading only ignores the trailing edge', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 50, { leading: true, trailing: false })
    debounced(1)
    debounced(2)
    vi.runAllTimers()
    expect(fn.mock.calls).toEqual([[1]])
  })

  it('cancel drops the pending call', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced(1)
    debounced.cancel()
    vi.runAllTimers()
    expect(fn).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

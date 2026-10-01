import { debounce } from '../debounce'

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('calls once with the latest arguments after the wait (trailing)', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 100)
    debounced(1)
    debounced(2)
    jest.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)
  })

  it('restarts the wait on every call', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 100)
    debounced('a')
    jest.advanceTimersByTime(80)
    debounced('b')
    jest.advanceTimersByTime(80)
    expect(fn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(20)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('with leading + trailing, a single call fires once', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 0, { leading: true, trailing: true })
    debounced('only')
    expect(fn).toHaveBeenCalledWith('only')
    jest.runAllTimers()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('with leading + trailing, a burst fires at both edges', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 0, { leading: true, trailing: true })
    debounced(1)
    debounced(2)
    debounced(3)
    expect(fn.mock.calls).toEqual([[1]])
    jest.runAllTimers()
    expect(fn.mock.calls).toEqual([[1], [3]])
    debounced(4)
    expect(fn.mock.calls).toEqual([[1], [3], [4]])
  })

  it('leading only ignores the trailing edge', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 50, { leading: true, trailing: false })
    debounced(1)
    debounced(2)
    jest.runAllTimers()
    expect(fn.mock.calls).toEqual([[1]])
  })

  it('cancel drops the pending call', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 100)
    debounced(1)
    debounced.cancel()
    jest.runAllTimers()
    expect(fn).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
})

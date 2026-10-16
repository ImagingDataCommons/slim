import { act, renderHook } from '@testing-library/react'

import NotificationMiddleware, {
  NotificationMiddlewareContext,
  NotificationMiddlewareEvents,
} from '../../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../../utils/CustomError'
import {
  appendCapped,
  MAX_NOTIFICATIONS,
  useNotifications,
} from '../useNotifications'

function publishError(message: string): CustomError {
  const error = new CustomError(errorTypes.COMMUNICATION, message)
  NotificationMiddleware.publish(NotificationMiddlewareEvents.OnError, {
    source: NotificationMiddlewareContext.DICOMWEB,
    error,
  })
  return error
}

function publishWarning(message: string): void {
  NotificationMiddleware.publish(
    NotificationMiddlewareEvents.OnWarning,
    message,
  )
}

describe('useNotifications', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useNotifications())
    expect(result.current.errors).toEqual([])
    expect(result.current.warnings).toEqual([])
    expect(result.current.errorCount).toBe(0)
    expect(result.current.warningCount).toBe(0)
  })

  it('collects errors with their source and warnings', () => {
    const { result } = renderHook(() => useNotifications())
    let error: CustomError | undefined
    act(() => {
      error = publishError('Search failed')
      publishWarning('High memory')
    })
    expect(result.current.errors).toEqual([
      { source: NotificationMiddlewareContext.DICOMWEB, error },
    ])
    expect(result.current.errors[0]?.error.type).toBe('Communication')
    expect(result.current.warnings).toEqual(['High memory'])
    expect(result.current.errorCount).toBe(1)
    expect(result.current.warningCount).toBe(1)
  })

  it('clears on demand', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => {
      publishError('a')
      publishWarning('b')
    })
    act(() => {
      result.current.clearNotifications()
    })
    expect(result.current.errorCount).toBe(0)
    expect(result.current.warningCount).toBe(0)
  })

  it('clears when the reset key changes, not on first render', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) => useNotifications({ resetKey }),
      { initialProps: { resetKey: '/' } },
    )
    act(() => {
      publishError('a')
    })
    rerender({ resetKey: '/' })
    expect(result.current.errorCount).toBe(1)
    rerender({ resetKey: '/studies/1' })
    expect(result.current.errorCount).toBe(0)
  })

  it('stops listening after unmount', () => {
    const { result, unmount } = renderHook(() => useNotifications())
    unmount()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => {
      publishError('late')
    })
    expect(result.current.errorCount).toBe(0)
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('appendCapped', () => {
  it('appends while under the limit', () => {
    expect(appendCapped([1, 2], 3, 5)).toEqual([1, 2, 3])
  })

  it('drops the oldest entries beyond the limit', () => {
    expect(appendCapped([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })
})

describe('useNotifications limit', () => {
  it(`keeps the ${MAX_NOTIFICATIONS} most recent warnings`, () => {
    const { result } = renderHook(() => useNotifications())
    act(() => {
      for (let index = 0; index <= MAX_NOTIFICATIONS; index++) {
        publishWarning(`warning ${index}`)
      }
    })
    expect(result.current.warningCount).toBe(MAX_NOTIFICATIONS)
    expect(result.current.warnings[0]).toBe('warning 1')
  })
})

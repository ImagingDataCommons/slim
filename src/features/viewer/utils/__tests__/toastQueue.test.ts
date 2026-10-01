import {
  dismissToast,
  enqueueToast,
  isToastTone,
  isToastToneDisabled,
  TOAST_DURATION_MS,
  type Toast,
  toastDurationMs,
  toToastNotification,
} from '../toastQueue'

function toast(id: number): Toast {
  return { id, message: `m${id}`, tone: 'info' }
}

describe('toToastNotification', () => {
  it('accepts plain strings as info toasts', () => {
    expect(toToastNotification('Saved')).toEqual({
      message: 'Saved',
      tone: 'info',
    })
  })

  it('keeps known tones and defaults unknown ones to info', () => {
    expect(toToastNotification({ message: 'Saved', tone: 'success' })).toEqual({
      message: 'Saved',
      tone: 'success',
    })
    expect(toToastNotification({ message: 'Hi', tone: 'loud' })).toEqual({
      message: 'Hi',
      tone: 'info',
    })
  })

  it('keeps the error tone and a non-empty title', () => {
    expect(
      toToastNotification({ message: 'Down', tone: 'error', title: 'Oops' }),
    ).toEqual({ message: 'Down', tone: 'error', title: 'Oops' })
    expect(toToastNotification({ message: 'Down', title: '' })).toEqual({
      message: 'Down',
      tone: 'info',
    })
  })

  it('rejects empty or malformed payloads', () => {
    expect(toToastNotification('')).toBeUndefined()
    expect(toToastNotification(null)).toBeUndefined()
    expect(toToastNotification(42)).toBeUndefined()
    expect(toToastNotification({ tone: 'info' })).toBeUndefined()
    expect(toToastNotification({ message: '  ' })).toBeUndefined()
  })
})

describe('enqueueToast', () => {
  it('appends toasts', () => {
    expect(enqueueToast([toast(1)], toast(2))).toEqual([toast(1), toast(2)])
  })

  it('drops the oldest beyond the limit', () => {
    expect(
      enqueueToast([toast(1), toast(2), toast(3)], toast(4), 3).map(
        (item) => item.id,
      ),
    ).toEqual([2, 3, 4])
  })

  it('always keeps the newest toast', () => {
    expect(enqueueToast([toast(1)], toast(2), 0)).toEqual([toast(2)])
  })
})

describe('isToastTone', () => {
  it('accepts the four tones only', () => {
    expect(['info', 'success', 'warning', 'error'].every(isToastTone)).toBe(
      true,
    )
    expect(isToastTone('loading')).toBe(false)
    expect(isToastTone(undefined)).toBe(false)
  })
})

describe('isToastToneDisabled', () => {
  it('enables everything without configuration', () => {
    expect(isToastToneDisabled('error', undefined)).toBe(false)
    expect(isToastToneDisabled('info', {})).toBe(false)
  })

  it('honors a global boolean', () => {
    expect(isToastToneDisabled('success', { disabled: true })).toBe(true)
    expect(isToastToneDisabled('success', { disabled: false })).toBe(false)
  })

  it('honors a list of disabled tones', () => {
    const config = { disabled: ['warning', 'info'] }
    expect(isToastToneDisabled('warning', config)).toBe(true)
    expect(isToastToneDisabled('info', config)).toBe(true)
    expect(isToastToneDisabled('error', config)).toBe(false)
  })
})

describe('toastDurationMs', () => {
  it('falls back to the default duration', () => {
    expect(toastDurationMs(undefined)).toBe(TOAST_DURATION_MS)
    expect(toastDurationMs({})).toBe(TOAST_DURATION_MS)
    expect(toastDurationMs({ duration: Number.NaN })).toBe(TOAST_DURATION_MS)
  })

  it('converts configured seconds to ms', () => {
    expect(toastDurationMs({ duration: 5 })).toBe(5000)
    expect(toastDurationMs({ duration: 0.5 })).toBe(500)
  })

  it('keeps toasts open for zero or negative durations', () => {
    expect(toastDurationMs({ duration: 0 })).toBeUndefined()
    expect(toastDurationMs({ duration: -1 })).toBeUndefined()
  })
})

describe('dismissToast', () => {
  it('removes the toast with the given id', () => {
    expect(dismissToast([toast(1), toast(2)], 1)).toEqual([toast(2)])
    expect(dismissToast([toast(1)], 9)).toEqual([toast(1)])
  })
})

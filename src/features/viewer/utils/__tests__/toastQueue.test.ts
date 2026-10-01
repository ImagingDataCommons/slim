import {
  dismissToast,
  enqueueToast,
  type Toast,
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

describe('dismissToast', () => {
  it('removes the toast with the given id', () => {
    expect(dismissToast([toast(1), toast(2)], 1)).toEqual([toast(2)])
    expect(dismissToast([toast(1)], 9)).toEqual([toast(1)])
  })
})

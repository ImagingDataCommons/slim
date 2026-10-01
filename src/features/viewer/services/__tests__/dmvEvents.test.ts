import { subscribeDmvEvents, subscribeDomEvents } from '../dmvEvents'

function publish(target: EventTarget, type: string, payload: unknown): void {
  target.dispatchEvent(
    new CustomEvent(type, { detail: { payload, time: new Date() } }),
  )
}

describe('subscribeDmvEvents', () => {
  it('passes detail.payload to the matching handler', () => {
    const target = new EventTarget()
    const onVisibility = jest.fn()
    subscribeDmvEvents(target, {
      dicommicroscopyviewer_segment_visibility_changed: onVisibility,
    })
    publish(target, 'dicommicroscopyviewer_segment_visibility_changed', {
      segmentUID: '1.2',
      isVisible: true,
    })
    expect(onVisibility).toHaveBeenCalledWith({
      segmentUID: '1.2',
      isVisible: true,
    })
  })

  it('ignores events that are not CustomEvents', () => {
    const target = new EventTarget()
    const onStarted = jest.fn()
    subscribeDmvEvents(target, {
      dicommicroscopyviewer_loading_started: onStarted,
    })
    target.dispatchEvent(new Event('dicommicroscopyviewer_loading_started'))
    expect(onStarted).not.toHaveBeenCalled()
  })

  it('passes undefined when the event has no detail', () => {
    const target = new EventTarget()
    const onEnded = jest.fn()
    subscribeDmvEvents(target, { dicommicroscopyviewer_loading_ended: onEnded })
    target.dispatchEvent(new CustomEvent('dicommicroscopyviewer_loading_ended'))
    expect(onEnded).toHaveBeenCalledWith(undefined)
  })

  it('removes every listener once, including error events', () => {
    const target = new EventTarget()
    const removeSpy = jest.spyOn(target, 'removeEventListener')
    const onError = jest.fn()
    const onFrameError = jest.fn()
    const unsubscribe = subscribeDmvEvents(target, {
      dicommicroscopyviewer_loading_error: onError,
      dicommicroscopyviewer_frame_loading_error: onFrameError,
    })
    unsubscribe()
    unsubscribe()
    publish(target, 'dicommicroscopyviewer_loading_error', null)
    publish(target, 'dicommicroscopyviewer_frame_loading_error', {})
    expect(onError).not.toHaveBeenCalled()
    expect(onFrameError).not.toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalledTimes(2)
  })

  it('skips undefined handlers', () => {
    const target = new EventTarget()
    const addSpy = jest.spyOn(target, 'addEventListener')
    subscribeDmvEvents(target, { dicommicroscopyviewer_roi_drawn: undefined })
    expect(addSpy).not.toHaveBeenCalled()
  })
})

describe('subscribeDomEvents', () => {
  it('adds and removes all listeners in the table', () => {
    const target = new EventTarget()
    const onKeyUp = jest.fn()
    const onKeyDown = jest.fn()
    const unsubscribe = subscribeDomEvents(target, [
      ['keyup', onKeyUp],
      ['keydown', onKeyDown],
    ])
    target.dispatchEvent(new Event('keyup'))
    target.dispatchEvent(new Event('keydown'))
    unsubscribe()
    target.dispatchEvent(new Event('keyup'))
    target.dispatchEvent(new Event('keydown'))
    expect(onKeyUp).toHaveBeenCalledTimes(1)
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})

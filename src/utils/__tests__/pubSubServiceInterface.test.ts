import pubSubInterface from '../pubSubServiceInterface'

function createService(): typeof pubSubInterface & {
  EVENTS: Record<string, string>
  listeners: {
    [eventName: string]: Array<{
      id: string
      callback: (data: unknown) => void
    }>
  }
} {
  return {
    ...pubSubInterface,
    EVENTS: { CHANGED: 'event::changed', ADDED: 'event::added' },
    listeners: {},
  }
}

describe('pubSubServiceInterface', () => {
  it('delivers broadcasts to the subscribers of that event only', () => {
    const service = createService()
    const onChanged = jest.fn()
    const onAdded = jest.fn()
    service.subscribe('event::changed', onChanged)
    service.subscribe('event::changed', onChanged)
    service.subscribe('event::added', onAdded)
    service._broadcastEvent('event::changed', { id: 1 })
    expect(onChanged).toHaveBeenCalledTimes(2)
    expect(onChanged).toHaveBeenCalledWith({ id: 1 })
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('stops delivering after unsubscribe', () => {
    const service = createService()
    const kept = jest.fn()
    const removed = jest.fn()
    service.subscribe('event::changed', kept)
    const subscription = service.subscribe('event::changed', removed)
    subscription.unsubscribe()
    service._broadcastEvent('event::changed', undefined)
    expect(kept).toHaveBeenCalledTimes(1)
    expect(removed).not.toHaveBeenCalled()
  })

  it('rejects events that are not declared', () => {
    const service = createService()
    expect(() => service.subscribe('event::unknown', jest.fn())).toThrow(
      'Event event::unknown not supported.',
    )
    expect(service._isValidEvent('event::added')).toBe(true)
    expect(service._isValidEvent('ADDED')).toBe(false)
  })

  it('ignores broadcasts and unsubscribes for events without listeners', () => {
    const service = createService()
    expect(() =>
      service._broadcastEvent('event::added', undefined),
    ).not.toThrow()
    expect(() => service._unsubscribe('event::added', 'id')).not.toThrow()
    expect(service.listeners).toEqual({})
  })
})

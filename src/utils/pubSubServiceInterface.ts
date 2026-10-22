import { v4 as generateUUID } from 'uuid'

type EventCallback = (data: unknown) => void

interface Subscription {
  id: string
  callback: EventCallback
}

/** State and helpers the consumer must provide alongside the mixin. */
interface PubSubService {
  EVENTS: Record<string, string>
  listeners: { [eventName: string]: Subscription[] }
  _isValidEvent: (eventName: string) => boolean
  _unsubscribe: (eventName: string, listenerId: string) => void
}

/**
 * Subscribe to `eventName`; throws for events not listed in `this.EVENTS`.
 */
function subscribe(
  this: PubSubService,
  eventName: string,
  callback: EventCallback,
): { unsubscribe: () => void } {
  if (!this._isValidEvent(eventName)) {
    throw new Error(`Event ${eventName} not supported.`)
  }
  const listenerId = generateUUID()
  const subscription = { id: listenerId, callback }
  if (Array.isArray(this.listeners[eventName])) {
    this.listeners[eventName].push(subscription)
  } else {
    this.listeners[eventName] = [subscription]
  }
  return {
    unsubscribe: () => this._unsubscribe(eventName, listenerId),
  }
}

function _unsubscribe(
  this: PubSubService,
  eventName: string,
  listenerId: string,
): void {
  const listeners = this.listeners[eventName]
  if (listeners === undefined) return
  this.listeners[eventName] = Array.isArray(listeners)
    ? listeners.filter(({ id }) => id !== listenerId)
    : []
}

function _isValidEvent(this: PubSubService, eventName: string): boolean {
  return Object.values(this.EVENTS).includes(eventName)
}

function _broadcastEvent(
  this: PubSubService,
  eventName: string,
  callbackProps: unknown,
): void {
  const listeners = this.listeners[eventName]
  if (!Array.isArray(listeners)) return
  for (const listener of listeners) {
    listener.callback(callbackProps)
  }
}

/**
 * Publish/subscribe mixin. Consumers must also define
 * `listeners = {}` and `EVENTS = { EVENT_KEY: 'event-value' }`.
 */
const pubSubInterface = {
  subscribe,
  _broadcastEvent,
  _unsubscribe,
  _isValidEvent,
}

export default pubSubInterface

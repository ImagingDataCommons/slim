import { v4 as generateUUID } from 'uuid'

/**
 * Consumer must implement:
 * this.listeners = {}
 * this.EVENTS = { "EVENT_KEY": "EVENT_VALUE" }
 */
const pubSubInterface = {
  subscribe,
  _broadcastEvent,
  _unsubscribe,
  _isValidEvent,
}

export default pubSubInterface

type EventCallback = (data: unknown) => void

/**
 * Subscribe to updates.
 *
 * @param {string} eventName The name of the event
 * @param {EventCallback} callback Events callback
 * @return {Object} Observable object with actions
 */
function subscribe(
  this: PubSubService,
  eventName: string,
  callback: EventCallback,
): { unsubscribe: () => void } {
  if (this._isValidEvent(eventName)) {
    const listenerId = generateUUID()
    const subscription = { id: listenerId, callback }

    // console.info(`Subscribing to '${eventName}'.`);
    if (Array.isArray(this.listeners[eventName])) {
      this.listeners[eventName].push(subscription)
    } else {
      this.listeners[eventName] = [subscription]
    }

    return {
      unsubscribe: () => this._unsubscribe(eventName, listenerId),
    }
  } else {
    throw new Error(`Event ${eventName} not supported.`)
  }
}

/**
 * Unsubscribe to measurement updates.
 *
 * @param {string} eventName The name of the event
 * @param {string} listenerId The listeners id
 * @return void
 */
function _unsubscribe(
  this: PubSubService,
  eventName: string,
  listenerId: string,
): void {
  if (this.listeners[eventName] === undefined) {
    return
  }

  const listeners = this.listeners[eventName]
  if (Array.isArray(listeners)) {
    this.listeners[eventName] = listeners.filter(({ id }) => id !== listenerId)
  } else {
    this.listeners[eventName] = []
  }
}

/**
 * Check if a given event is valid.
 *
 * @param {string} eventName The name of the event
 * @return {boolean} Event name validation
 */
function _isValidEvent(this: PubSubService, eventName: string): boolean {
  return Object.values(this.EVENTS).includes(eventName)
}

/**
 * Broadcasts changes.
 *
 * @param {string} eventName - The event name
 * @param {unknown} callbackProps - Properties to pass to callbacks
 * @return void
 */
function _broadcastEvent(
  this: PubSubService,
  eventName: string,
  callbackProps: unknown,
): void {
  const hasListeners = Object.keys(this.listeners).length > 0
  const hasCallbacks = Array.isArray(this.listeners[eventName])

  if (hasListeners && hasCallbacks) {
    this.listeners[eventName].forEach(
      (listener: { id: string; callback: EventCallback }) => {
        listener.callback(callbackProps)
      },
    )
  }
}

/** Export a PubSubService class to be used instead of the individual items */
export class PubSubService {
  EVENTS: Record<string, string>
  subscribe: (
    eventName: string,
    callback: EventCallback,
  ) => { unsubscribe: () => void }

  _broadcastEvent: (eventName: string, callbackProps: unknown) => void
  _unsubscribe: (eventName: string, listenerId: string) => void
  _isValidEvent: (eventName: string) => boolean
  listeners: { [key: string]: Array<{ id: string; callback: EventCallback }> }
  unsubscriptions: Array<() => void>
  constructor(EVENTS: Record<string, string>) {
    this.EVENTS = EVENTS
    this.subscribe = subscribe
    this._broadcastEvent = _broadcastEvent
    this._unsubscribe = _unsubscribe
    this._isValidEvent = _isValidEvent
    this.listeners = {}
    this.unsubscriptions = []
  }

  reset(): void {
    this.unsubscriptions.forEach((unsub) => {
      unsub()
    })
    this.unsubscriptions = []
  }

  /**
   * Creates an event that records whether or not someone
   * has consumed it.  Call eventData.consume() to consume the event.
   * Check eventData.isConsumed to see if it is consumed or not.
   * @param props - to include in the event
   */
  protected createConsumableEvent(
    props: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...props,
      isConsumed: false,
      consume: function Consume() {
        this.isConsumed = true
      },
    }
  }
}

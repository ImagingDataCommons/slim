import type { events } from 'dicom-microscopy-viewer'

export type DmvEventName = events.EventName

export type DmvEventPayload<K extends DmvEventName> = events.EventPayloadMap[K]

/** Handlers keyed by DMV event name; each receives `event.detail.payload`. */
export type DmvEventHandlers = {
  [K in DmvEventName]?: (payload: DmvEventPayload<K>) => void
}

function listenerFor<K extends DmvEventName>(
  handler: (payload: DmvEventPayload<K>) => void,
): (event: Event) => void {
  return (event: Event): void => {
    if (!(event instanceof CustomEvent)) return
    /** DMV wraps every payload as `detail.payload` (null when omitted) */
    handler(event.detail?.payload)
  }
}

/**
 * Subscribe to DMV CustomEvents published on `target` (DMV events bubble to
 * `document.body`). Returns one function that removes every listener, so
 * subscription and cleanup cannot drift apart.
 */
export function subscribeDmvEvents(
  target: EventTarget,
  handlers: DmvEventHandlers,
): () => void {
  const listeners: Array<[string, (event: Event) => void]> = []
  const add = <K extends DmvEventName>(name: K): void => {
    const handler = handlers[name]
    if (handler === undefined) return
    const listener = listenerFor(handler)
    target.addEventListener(name, listener)
    listeners.push([name, listener])
  }
  for (const name of Object.keys(handlers)) {
    if (isDmvEventName(name, handlers)) add(name)
  }
  let isSubscribed = true
  return () => {
    if (!isSubscribed) return
    isSubscribed = false
    for (const [name, listener] of listeners) {
      target.removeEventListener(name, listener)
    }
  }
}

function isDmvEventName(
  name: string,
  handlers: DmvEventHandlers,
): name is DmvEventName {
  return Object.hasOwn(handlers, name)
}

/**
 * Add DOM listeners from a `[type, listener]` table and return a single
 * function that removes all of them.
 */
export function subscribeDomEvents<T extends EventTarget>(
  target: T,
  entries: ReadonlyArray<readonly [string, EventListener]>,
): () => void {
  for (const [type, listener] of entries) {
    target.addEventListener(type, listener)
  }
  let isSubscribed = true
  return () => {
    if (!isSubscribed) return
    isSubscribed = false
    for (const [type, listener] of entries) {
      target.removeEventListener(type, listener)
    }
  }
}

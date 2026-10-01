import { useLayoutEffect } from 'react'

import {
  type DmvEventHandlers,
  type DmvEventName,
  subscribeDmvEvents,
} from '../services/dmvEvents'
import { useLatestRef } from './useLatestRef'

function isHandledEvent(
  name: string,
  handlers: DmvEventHandlers,
): name is DmvEventName {
  return Object.hasOwn(handlers, name)
}

function forwardTo<K extends DmvEventName>(
  forwarders: DmvEventHandlers,
  name: K,
  handlersRef: { readonly current: DmvEventHandlers },
): void {
  forwarders[name] = (payload) => {
    handlersRef.current[name]?.(payload)
  }
}

/**
 * Listen to DMV events on `document.body` for the component's lifetime,
 * always calling the handlers of the latest render. The set of event names
 * is fixed by the first render. Subscribes in a layout effect so that no
 * event of viewers created in passive effects is missed.
 */
export function useDmvEvents(handlers: DmvEventHandlers): void {
  const handlersRef = useLatestRef(handlers)
  useLayoutEffect(() => {
    const forwarders: DmvEventHandlers = {}
    for (const name of Object.keys(handlersRef.current)) {
      if (isHandledEvent(name, handlersRef.current)) {
        forwardTo(forwarders, name, handlersRef)
      }
    }
    return subscribeDmvEvents(document.body, forwarders)
  }, [handlersRef])
}

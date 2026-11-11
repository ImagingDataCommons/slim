import { useEffectEvent, useLayoutEffect, useRef } from 'react'

import {
  type DmvEventHandlers,
  type DmvEventName,
  subscribeDmvEvents,
} from '../services/dmvEvents'

function isHandledEvent(
  name: string,
  handlers: DmvEventHandlers,
): name is DmvEventName {
  return Object.hasOwn(handlers, name)
}

/**
 * Listen to DMV events on `document.body` for the component's lifetime,
 * always calling the handlers of the latest render via `useEffectEvent`.
 * The set of event names is fixed by the first render. Subscribes in a
 * layout effect so that no event of viewers created in passive effects is
 * missed.
 */
export function useDmvEvents(handlers: DmvEventHandlers): void {
  const eventNamesRef = useRef<DmvEventName[] | undefined>(undefined)
  if (eventNamesRef.current === undefined) {
    eventNamesRef.current = Object.keys(handlers).filter(
      (name): name is DmvEventName => isHandledEvent(name, handlers),
    )
  }

  const onEvent = useEffectEvent(
    (name: DmvEventName, payload: unknown): void => {
      const handler = handlers[name] as ((value: unknown) => void) | undefined
      handler?.(payload)
    },
  )

  useLayoutEffect(() => {
    const forwarders: DmvEventHandlers = {}
    for (const name of eventNamesRef.current ?? []) {
      forwarders[name] = (payload) => {
        onEvent(name, payload)
      }
    }
    return subscribeDmvEvents(document.body, forwarders)
  }, [])
}

import { renderHook } from '@testing-library/react'

import type { DmvEventHandlers } from '../../services/dmvEvents'
import { useDmvEvents } from '../useDmvEvents'

function publish(name: string, payload: unknown): void {
  document.body.dispatchEvent(new CustomEvent(name, { detail: { payload } }))
}

describe('useDmvEvents', () => {
  it('passes payloads to the handlers of the latest render', () => {
    const first = vi.fn()
    const latest = vi.fn()
    const { rerender } = renderHook(
      ({ handlers }: { handlers: DmvEventHandlers }) => useDmvEvents(handlers),
      {
        initialProps: {
          handlers: { dicommicroscopyviewer_loading_started: first },
        },
      },
    )
    rerender({ handlers: { dicommicroscopyviewer_loading_started: latest } })

    publish('dicommicroscopyviewer_loading_started', 'payload')

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith('payload')
  })

  it('only listens to the events handled on the first render', () => {
    const ended = vi.fn()
    const { rerender } = renderHook(
      ({ handlers }: { handlers: DmvEventHandlers }) => useDmvEvents(handlers),
      { initialProps: { handlers: {} } },
    )
    rerender({ handlers: { dicommicroscopyviewer_loading_ended: ended } })

    publish('dicommicroscopyviewer_loading_ended', null)

    expect(ended).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const started = vi.fn()
    const { unmount } = renderHook(() =>
      useDmvEvents({ dicommicroscopyviewer_loading_started: started }),
    )

    unmount()
    publish('dicommicroscopyviewer_loading_started', null)

    expect(started).not.toHaveBeenCalled()
  })
})

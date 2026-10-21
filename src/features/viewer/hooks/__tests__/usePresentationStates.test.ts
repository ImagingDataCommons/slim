import { act, renderHook } from '@testing-library/react'
import type * as dmv from 'dicom-microscopy-viewer'
import type { Location } from 'react-router'

import { loadPresentationStates } from '../../services/presentationStates'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestClients, createTestSession } from '../../testing/fixtures'
import { usePresentationStates } from '../usePresentationStates'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')
vi.mock('../../services/presentationStates', () => ({
  loadPresentationStates: vi.fn(),
}))

type PresentationState = dmv.metadata.AdvancedBlendingPresentationState
type OnPresentationState = Parameters<
  typeof loadPresentationStates
>[0]['onPresentationState']

function presentationState(uid: string): PresentationState {
  const fields: Partial<PresentationState> = { SOPInstanceUID: uid }
  return fields as PresentationState
}

const location: Location = {
  pathname: '/studies/1/series/2',
  search: '?x=1',
  hash: '',
  state: null,
  key: 'default',
}

function setup(requestedUID?: string) {
  const test = createTestSession()
  const navigate = vi.fn()
  const opticalPaths = {
    showDefault: vi.fn(),
    showPresentationState: vi.fn(),
  }
  let deliver: OnPresentationState = () => {}
  let deliverDefault: (ps: PresentationState) => void = () => {}
  vi.mocked(loadPresentationStates).mockImplementation((options) => {
    deliver = options.onPresentationState
    deliverDefault = options.onDefaultPresentationState ?? (() => {})
  })
  const { result, rerender } = renderHook(
    ({ currentLocation }: { currentLocation: Location }) =>
      usePresentationStates({
        sessionRef: test.access.sessionRef,
        clients: createTestClients(),
        studyInstanceUID: '1',
        requestedUID,
        location: currentLocation,
        navigate,
        opticalPaths,
      }),
    { initialProps: { currentLocation: location } },
  )
  const load = (): void => {
    act(() => {
      result.current.load(test.session)
    })
  }
  const receive = (ps: PresentationState, index: number): void => {
    act(() => {
      deliver(ps, index)
    })
  }
  /** The loader names the slide's first state once earlier ones settled */
  const receiveDefault = (ps: PresentationState): void => {
    act(() => {
      deliverDefault(ps)
    })
  }
  return {
    ...test,
    result,
    rerender,
    navigate,
    opticalPaths,
    load,
    receive,
    receiveDefault,
  }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('usePresentationStates', () => {
  it("applies the slide's first state when the URL names none", () => {
    const {
      result,
      load,
      receive,
      receiveDefault,
      navigate,
      opticalPaths,
      session,
    } = setup()
    const first = presentationState('ps-1')

    load()
    receive(presentationState('ps-2'), 1)
    receive(first, 0)
    expect(opticalPaths.showPresentationState).not.toHaveBeenCalled()
    receiveDefault(first)

    expect(opticalPaths.showPresentationState).toHaveBeenCalledTimes(1)
    expect(opticalPaths.showPresentationState).toHaveBeenCalledWith(
      session,
      first,
    )
    expect(navigate).toHaveBeenCalledWith(
      { pathname: location.pathname, search: 'x=1&state=ps-1' },
      { replace: true },
    )
    expect(result.current.selectedUID).toBe('ps-1')
    expect(
      result.current.presentationStates.map((ps) => ps.SOPInstanceUID),
    ).toEqual(['ps-1', 'ps-2'])
  })

  it('does not apply a late default state over changes the user made', () => {
    const {
      result,
      load,
      receive,
      receiveDefault,
      navigate,
      opticalPaths,
      session,
    } = setup()

    load()
    session.hasUserDisplayChanges = true
    receive(presentationState('ps-1'), 0)
    receiveDefault(presentationState('ps-1'))

    expect(opticalPaths.showPresentationState).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(result.current.presentationStates).toHaveLength(1)
  })

  it('still applies a state the URL names after user changes', () => {
    const { load, receive, opticalPaths, session } = setup('ps-1')

    load()
    session.hasUserDisplayChanges = true
    receive(presentationState('ps-1'), 0)

    expect(opticalPaths.showPresentationState).toHaveBeenCalledTimes(1)
  })

  it('applies the state named in the URL', () => {
    const { result, load, receive, opticalPaths } = setup('ps-2')

    load()
    receive(presentationState('ps-1'), 0)
    receive(presentationState('ps-2'), 1)

    expect(opticalPaths.showPresentationState).toHaveBeenCalledTimes(1)
    expect(result.current.selectedUID).toBe('ps-2')
  })

  it('reports no selection when the URL names a state the study lacks', () => {
    const { result, load, receive, opticalPaths } = setup('unknown')

    load()
    receive(presentationState('ps-1'), 0)

    expect(opticalPaths.showPresentationState).not.toHaveBeenCalled()
    expect(result.current.selectedUID).toBeUndefined()
  })

  it('ignores states retrieved for released viewers', () => {
    const { result, load, receive, session, opticalPaths } = setup()

    load()
    session.isDestroyed = true
    receive(presentationState('ps-1'), 0)

    expect(opticalPaths.showPresentationState).not.toHaveBeenCalled()
    expect(result.current.presentationStates).toEqual([])
  })

  it('ignores states that arrive after the URL moved to another slide', () => {
    const { result, rerender, load, receiveDefault, navigate, opticalPaths } =
      setup()

    load()
    rerender({
      currentLocation: { ...location, pathname: '/studies/1/series/3' },
    })
    receiveDefault(presentationState('ps-1'))

    expect(opticalPaths.showPresentationState).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(result.current.selectedUID).toBeUndefined()
  })

  it('selecting a listed state applies it', () => {
    const { result, load, receive, navigate, opticalPaths } = setup('none')
    load()
    receive(presentationState('ps-1'), 0)

    act(() => {
      result.current.onSelect('ps-1')
    })

    expect(navigate).toHaveBeenCalledWith(`${location.pathname}?state=ps-1`)
    expect(opticalPaths.showPresentationState).toHaveBeenCalledTimes(1)
    expect(result.current.selectedUID).toBe('ps-1')
  })

  it('does not carry the last pick over to a new session', () => {
    const { result, load, receive, opticalPaths } = setup('none')
    load()
    receive(presentationState('ps-1'), 0)
    act(() => {
      result.current.onSelect('ps-1')
    })
    expect(result.current.selectedUID).toBe('ps-1')

    load()
    receive(presentationState('ps-1'), 0)

    expect(result.current.selectedUID).toBeUndefined()
    expect(opticalPaths.showPresentationState).toHaveBeenCalledTimes(1)
  })

  it('clearing the selection shows the default paths', () => {
    const { result, navigate, opticalPaths, session } = setup('ps-1')

    act(() => {
      result.current.onSelect(undefined)
    })

    expect(result.current.selectedUID).toBeUndefined()
    expect(navigate).toHaveBeenCalledWith(location.pathname)
    expect(opticalPaths.showDefault).toHaveBeenCalledWith(session)
  })
})

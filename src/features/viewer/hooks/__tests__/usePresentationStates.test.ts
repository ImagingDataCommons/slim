import { act, renderHook } from '@testing-library/react'
import type * as dmv from 'dicom-microscopy-viewer'
import type { Location } from 'react-router-dom'

import { loadPresentationStates } from '../../services/presentationStates'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestClients, createTestSession } from '../../testing/fixtures'
import { usePresentationStates } from '../usePresentationStates'

jest.mock(
  'dicom-microscopy-viewer',
  () =>
    jest.requireActual<typeof import('../../testing/fakeDmv')>(
      '../../testing/fakeDmv',
    ).fakeDmvModule,
)
jest.mock('../../../../utils/logger')
jest.mock('../../services/presentationStates', () => ({
  loadPresentationStates: jest.fn(),
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
  const navigate = jest.fn()
  const opticalPaths = {
    showDefault: jest.fn(),
    showPresentationState: jest.fn(),
  }
  let deliver: OnPresentationState = () => {}
  jest.mocked(loadPresentationStates).mockImplementation((options) => {
    deliver = options.onPresentationState
  })
  const { result } = renderHook(() =>
    usePresentationStates({
      sessionRef: test.access.sessionRef,
      clients: createTestClients(),
      studyInstanceUID: '1',
      requestedUID,
      location,
      navigate,
      opticalPaths,
    }),
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
  return { ...test, result, navigate, opticalPaths, load, receive }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('usePresentationStates', () => {
  it('applies the first state when the URL names none', () => {
    const { result, load, receive, navigate, opticalPaths, session } = setup()
    const first = presentationState('ps-1')

    load()
    receive(first, 0)
    receive(presentationState('ps-2'), 1)

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

  it('applies the state named in the URL', () => {
    const { result, load, receive, opticalPaths } = setup('ps-2')

    load()
    receive(presentationState('ps-1'), 0)
    receive(presentationState('ps-2'), 1)

    expect(opticalPaths.showPresentationState).toHaveBeenCalledTimes(1)
    expect(result.current.selectedUID).toBe('ps-2')
  })

  it('ignores states retrieved for released viewers', () => {
    const { result, load, receive, session, opticalPaths } = setup()

    load()
    session.isDestroyed = true
    receive(presentationState('ps-1'), 0)

    expect(opticalPaths.showPresentationState).not.toHaveBeenCalled()
    expect(result.current.presentationStates).toEqual([])
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

import {
  applyTileStatusChange,
  frameEventKey,
  frameEventSopInstanceUID,
  INITIAL_TILE_COUNTS,
  nextTileStatus,
  recordTileStatus,
  type TileCounts,
  type TileEventKind,
  type TileStatus,
} from '../tileCounts'

describe('recordTileStatus', () => {
  it('stores the status as the most recent entry', () => {
    const statuses = new Map<string, TileStatus>([
      ['a', 'loading'],
      ['b', 'loaded'],
    ])
    recordTileStatus(statuses, 'a', 'loaded', 10)
    expect(Array.from(statuses)).toEqual([
      ['b', 'loaded'],
      ['a', 'loaded'],
    ])
  })

  it('evicts the oldest settled entry past the limit', () => {
    const statuses = new Map<string, TileStatus>([
      ['inflight', 'loading'],
      ['done', 'loaded'],
      ['failed', 'failed'],
    ])
    recordTileStatus(statuses, 'new', 'loading', 3)
    expect(Array.from(statuses.keys())).toEqual(['inflight', 'failed', 'new'])
  })

  it('evicts the oldest entry when every frame is in flight', () => {
    const statuses = new Map<string, TileStatus>([
      ['a', 'loading'],
      ['b', 'loading'],
    ])
    recordTileStatus(statuses, 'c', 'loading', 2)
    expect(Array.from(statuses.keys())).toEqual(['b', 'c'])
  })
})

describe('frameEventKey', () => {
  it('combines SOP instance UID and frame number', () => {
    expect(
      frameEventKey({ payload: { sopInstanceUID: '1.2.3', frameNumber: 7 } }),
    ).toBe('1.2.3-7')
    expect(
      frameEventKey({ payload: { sopInstanceUID: '1.2.3', frameNumber: '7' } }),
    ).toBe('1.2.3-7')
  })

  it('returns undefined for malformed details', () => {
    expect(frameEventKey(undefined)).toBeUndefined()
    expect(frameEventKey(null)).toBeUndefined()
    expect(frameEventKey({})).toBeUndefined()
    expect(frameEventKey({ payload: null })).toBeUndefined()
    expect(frameEventKey({ payload: { frameNumber: 1 } })).toBeUndefined()
    expect(
      frameEventKey({ payload: { sopInstanceUID: '1.2.3' } }),
    ).toBeUndefined()
  })
})

describe('frameEventSopInstanceUID', () => {
  it('reads the SOP instance UID', () => {
    expect(frameEventSopInstanceUID({ payload: { sopInstanceUID: 'a' } })).toBe(
      'a',
    )
    expect(
      frameEventSopInstanceUID({ payload: { sopInstanceUID: '' } }),
    ).toBeUndefined()
  })
})

describe('nextTileStatus', () => {
  it('follows a successful load', () => {
    expect(nextTileStatus(undefined, 'started')).toBe('loading')
    expect(nextTileStatus('loading', 'ended')).toBe('loaded')
  })

  it('marks a frame failed even though DMV sends ended first', () => {
    expect(nextTileStatus('loaded', 'error')).toBe('failed')
    expect(nextTileStatus('failed', 'ended')).toBe('failed')
  })

  it('clears a failure on retry', () => {
    expect(nextTileStatus('failed', 'started')).toBe('loading')
  })

  it('keeps loaded frames loaded when requested again', () => {
    expect(nextTileStatus('loaded', 'started')).toBe('loaded')
  })
})

function replay(events: Array<[string, TileEventKind]>): TileCounts {
  const statuses = new Map<string, TileStatus>()
  let counts = INITIAL_TILE_COUNTS
  for (const [key, kind] of events) {
    const previous = statuses.get(key)
    const next = nextTileStatus(previous, kind)
    statuses.set(key, next)
    counts = applyTileStatusChange(counts, previous, next)
  }
  return counts
}

describe('applyTileStatusChange', () => {
  it('counts loaded and failed frames separately', () => {
    expect(
      replay([
        ['a', 'started'],
        ['b', 'started'],
        ['c', 'started'],
        ['a', 'ended'],
        ['b', 'ended'],
        ['b', 'error'],
      ]),
    ).toEqual({ requested: 3, loaded: 1, failed: 1 })
  })

  it('does not double count repeated events', () => {
    expect(
      replay([
        ['a', 'started'],
        ['a', 'started'],
        ['a', 'ended'],
        ['a', 'ended'],
      ]),
    ).toEqual({ requested: 1, loaded: 1, failed: 0 })
  })

  it('moves a retried frame from failed to loaded', () => {
    expect(
      replay([
        ['a', 'started'],
        ['a', 'ended'],
        ['a', 'error'],
        ['a', 'started'],
        ['a', 'ended'],
      ]),
    ).toEqual({ requested: 1, loaded: 1, failed: 0 })
  })

  it('returns the same object when the status is unchanged', () => {
    const counts = { requested: 1, loaded: 1, failed: 0 }
    expect(applyTileStatusChange(counts, 'loaded', 'loaded')).toBe(counts)
  })
})

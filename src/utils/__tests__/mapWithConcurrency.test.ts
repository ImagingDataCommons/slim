import { mapWithConcurrency } from '../mapWithConcurrency'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('mapWithConcurrency', () => {
  it('returns results in input order', async () => {
    const results = await mapWithConcurrency([30, 10, 20], 2, async (value) => {
      await new Promise((done) => setTimeout(done, value))
      return value * 2
    })
    expect(results).toEqual([60, 20, 40])
  })

  it('never exceeds the limit', async () => {
    let active = 0
    let peak = 0
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, index) => index),
      6,
      async () => {
        active += 1
        peak = Math.max(peak, active)
        await Promise.resolve()
        active -= 1
      },
    )
    expect(peak).toBe(6)
  })

  it('starts the next item as soon as a slot frees up', async () => {
    const gates = [deferred(), deferred(), deferred()]
    const started: number[] = []
    const run = mapWithConcurrency([0, 1, 2], 2, async (index) => {
      started.push(index)
      await gates[index].promise
      return index
    })
    await Promise.resolve()
    expect(started).toEqual([0, 1])
    gates[1].resolve()
    await new Promise((done) => setTimeout(done, 0))
    expect(started).toEqual([0, 1, 2])
    gates[0].resolve()
    gates[2].resolve()
    await expect(run).resolves.toEqual([0, 1, 2])
  })

  it('handles empty input', async () => {
    await expect(mapWithConcurrency([], 6, async () => 1)).resolves.toEqual([])
  })

  async function peakConcurrency(limit: number): Promise<{
    results: number[]
    peak: number
  }> {
    let active = 0
    let peak = 0
    const results = await mapWithConcurrency([1, 2, 3, 4], limit, async (v) => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      return v * 10
    })
    return { results, peak }
  }

  it.each([
    ['zero', 0],
    ['negative', -3],
    ['fractional below 1', 0.5],
    ['NaN', Number.NaN],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('runs serially for a %s limit', async (_label, limit) => {
    await expect(peakConcurrency(limit)).resolves.toEqual({
      results: [10, 20, 30, 40],
      peak: 1,
    })
  })

  it('floors fractional limits', async () => {
    await expect(peakConcurrency(2.9)).resolves.toEqual({
      results: [10, 20, 30, 40],
      peak: 2,
    })
  })

  it('runs everything at once for an infinite limit', async () => {
    await expect(peakConcurrency(Number.POSITIVE_INFINITY)).resolves.toEqual({
      results: [10, 20, 30, 40],
      peak: 4,
    })
  })

  it('rejects when a mapper rejects', async () => {
    await expect(
      mapWithConcurrency([1], 2, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })
})

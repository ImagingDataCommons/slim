import { createSingleFlight } from '../utils/singleFlight'

/** A promise whose resolution this test controls. */
const deferred = <T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createSingleFlight', () => {
  it('runs the operation once for concurrent callers sharing a key', async () => {
    const gate = createSingleFlight<string>()
    const run = jest.fn(async () => await Promise.resolve('token'))

    const results = await Promise.all([
      gate('https://a.test', run),
      gate('https://a.test', run),
      gate('https://a.test', run),
    ])

    expect(run).toHaveBeenCalledTimes(1)
    expect(results).toEqual(['token', 'token', 'token'])
  })

  it('gives every concurrent caller the same answer', async () => {
    const gate = createSingleFlight<string>()
    const control = deferred<string>()
    const run = jest.fn(async () => await control.promise)

    const first = gate('https://a.test', run)
    const second = gate('https://a.test', run)
    control.resolve('shared')

    expect(await first).toBe('shared')
    expect(await second).toBe('shared')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('keeps distinct keys independent', async () => {
    const gate = createSingleFlight<string>()
    const run = jest.fn(async (value: string) => await Promise.resolve(value))

    await Promise.all([
      gate('https://a.test', async () => await run('a')),
      gate('https://b.test', async () => await run('b')),
    ])

    expect(run).toHaveBeenCalledTimes(2)
  })

  it('releases the key so a later call starts a fresh run', async () => {
    const gate = createSingleFlight<string>()
    const run = jest.fn(async () => await Promise.resolve('token'))

    await gate('https://a.test', run)
    await gate('https://a.test', run)

    // Sequential callers must not replay a stale answer.
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('propagates a rejection to every joined caller and releases the key', async () => {
    const gate = createSingleFlight<string>()
    const failing = jest.fn(async () => await Promise.reject(new Error('nope')))

    const first = gate('https://a.test', failing)
    const second = gate('https://a.test', failing)

    await expect(first).rejects.toThrow('nope')
    await expect(second).rejects.toThrow('nope')
    expect(failing).toHaveBeenCalledTimes(1)

    // A failed run must not poison the key.
    const succeeding = jest.fn(async () => await Promise.resolve('token'))
    await expect(gate('https://a.test', succeeding)).resolves.toBe('token')
  })
})

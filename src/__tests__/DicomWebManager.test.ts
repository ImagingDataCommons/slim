// skipcq: JS-C1003
import * as dwc from 'dicomweb-client'

import DicomWebManager from '../DicomWebManager'

interface StubClient {
  baseURL: string
  headers: Record<string, string>
  searchForStudies: jest.Mock
  searchForSeries: jest.Mock
  searchForInstances: jest.Mock
  retrieveStudyMetadata: jest.Mock
  retrieveSeriesMetadata: jest.Mock
  retrieveInstance: jest.Mock
  retrieveInstanceMetadata: jest.Mock
  retrieveInstanceFrames: jest.Mock
  retrieveInstanceRendered: jest.Mock
  retrieveInstanceFramesRendered: jest.Mock
  retrieveBulkData: jest.Mock
  storeInstances: jest.Mock
}

interface ManagerInternals {
  stores: Array<{
    id: string
    read: boolean
    write: boolean
    client: StubClient
  }>
}

const makeStubClient = (id: string): StubClient => ({
  baseURL: `https://example.test/${id}/dicomWeb`,
  headers: {},
  searchForStudies: jest.fn(),
  searchForSeries: jest.fn(),
  searchForInstances: jest.fn(),
  retrieveStudyMetadata: jest.fn(),
  retrieveSeriesMetadata: jest.fn(),
  retrieveInstance: jest.fn(),
  retrieveInstanceMetadata: jest.fn(),
  retrieveInstanceFrames: jest.fn(),
  retrieveInstanceRendered: jest.fn(),
  retrieveInstanceFramesRendered: jest.fn(),
  retrieveBulkData: jest.fn(),
  storeInstances: jest.fn(),
})

/**
 * Replace the underlying dwc client of every store with a stub so we can test
 * the multi-store search/retrieve semantics without making real HTTP requests.
 */
const stubManagerClients = (
  manager: DicomWebManager,
  stubs: StubClient[],
): void => {
  const internals = manager as unknown as ManagerInternals
  expect(internals.stores.length).toBe(stubs.length)
  internals.stores.forEach((store, i) => {
    store.client = stubs[i]
  })
}

const baseUri = 'https://example.test'

/** Error shaped like the one dicomweb-client rejects with. */
const httpError = (status: number): Error & { status: number } =>
  Object.assign(new Error(`request failed (${status})`), { status })

/** Policy that treats every origin as already approved. */
const allowAllPolicy = (
  token = 'Bearer abc',
): {
  isPreAuthorized: jest.Mock
  requestAuthorization: jest.Mock
} => ({
  isPreAuthorized: jest.fn().mockReturnValue(true),
  requestAuthorization: jest.fn().mockResolvedValue(token),
})

/** Policy that grants only when challenged, mimicking the consent prompt. */
const consentPolicy = (
  approved: boolean,
  token = 'Bearer abc',
): {
  isPreAuthorized: jest.Mock
  requestAuthorization: jest.Mock
} => ({
  isPreAuthorized: jest.fn().mockReturnValue(false),
  requestAuthorization: jest
    .fn()
    .mockResolvedValue(approved ? token : undefined),
})

describe('DicomWebManager - multi-store search', () => {
  it('merges searchForSeries results across stores and de-duplicates by SeriesInstanceUID', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    primaryStub.searchForSeries.mockResolvedValue([
      {
        '0020000D': { vr: 'UI', Value: ['1.2.3'] },
        '0020000E': { vr: 'UI', Value: ['1.2.3.A'] },
        '00080060': { vr: 'CS', Value: ['ANN'] },
      },
      // Same SeriesInstanceUID appears in both stores; should be deduped.
      {
        '0020000D': { vr: 'UI', Value: ['1.2.3'] },
        '0020000E': { vr: 'UI', Value: ['1.2.3.SHARED'] },
        '00080060': { vr: 'CS', Value: ['SR'] },
      },
    ])
    secondaryStub.searchForSeries.mockResolvedValue([
      {
        '0020000D': { vr: 'UI', Value: ['1.2.3'] },
        '0020000E': { vr: 'UI', Value: ['1.2.3.B'] },
        '00080060': { vr: 'CS', Value: ['PM'] },
      },
      {
        '0020000D': { vr: 'UI', Value: ['1.2.3'] },
        '0020000E': { vr: 'UI', Value: ['1.2.3.SHARED'] },
        '00080060': { vr: 'CS', Value: ['SR'] },
      },
    ])

    const merged = await manager.searchForSeries({
      studyInstanceUID: '1.2.3',
    } as dwc.api.SearchForSeriesOptions)

    expect(primaryStub.searchForSeries).toHaveBeenCalledTimes(1)
    expect(secondaryStub.searchForSeries).toHaveBeenCalledTimes(1)
    expect(merged.length).toBe(3)
    const seriesUIDs = (
      merged as unknown as Array<Record<string, { Value?: string[] }>>
    )
      .map((m) => m['0020000E']?.Value?.[0])
      .sort()
    expect(seriesUIDs).toEqual(['1.2.3.A', '1.2.3.B', '1.2.3.SHARED'])
  })

  it('still returns results from the other store when one store fails', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    primaryStub.searchForSeries.mockRejectedValue(new Error('boom'))
    secondaryStub.searchForSeries.mockResolvedValue([
      {
        '0020000D': { vr: 'UI', Value: ['1.2.3'] },
        '0020000E': { vr: 'UI', Value: ['1.2.3.B'] },
      },
    ])

    const merged = await manager.searchForSeries({
      studyInstanceUID: '1.2.3',
    } as dwc.api.SearchForSeriesOptions)

    expect(merged.length).toBe(1)
    expect(
      (merged[0] as unknown as Record<string, { Value?: string[] }>)[
        '0020000E'
      ]?.Value?.[0],
    ).toBe('1.2.3.B')
  })

  it('skips stores marked as not readable during searches', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        {
          id: 'primary',
          url: 'https://primary.test/dicomWeb',
          write: false,
          read: false,
        },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    secondaryStub.searchForInstances.mockResolvedValue([
      {
        '0020000D': { vr: 'UI', Value: ['1.2.3'] },
        '0020000E': { vr: 'UI', Value: ['1.2.3.B'] },
        '00080018': { vr: 'UI', Value: ['1.2.3.B.1'] },
      },
    ])

    const merged = await manager.searchForInstances({
      studyInstanceUID: '1.2.3',
    } as dwc.api.SearchForInstancesOptions)

    expect(primaryStub.searchForInstances).not.toHaveBeenCalled()
    expect(secondaryStub.searchForInstances).toHaveBeenCalledTimes(1)
    expect(merged.length).toBe(1)
  })
})

describe('DicomWebManager - multi-store retrieve fallback', () => {
  it('returns the primary store result when it succeeds without falling back', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    primaryStub.retrieveInstanceFrames.mockResolvedValue(['frame-from-primary'])

    const frames = await manager.retrieveInstanceFrames({
      studyInstanceUID: '1.2.3',
      seriesInstanceUID: '1.2.3.A',
      sopInstanceUID: '1.2.3.A.1',
      frameNumbers: [1],
    } as dwc.api.RetrieveInstanceFramesOptions)

    expect(primaryStub.retrieveInstanceFrames).toHaveBeenCalledTimes(1)
    expect(secondaryStub.retrieveInstanceFrames).not.toHaveBeenCalled()
    expect(frames).toEqual(['frame-from-primary'])
  })

  it('falls back to the secondary store when the primary store rejects', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    primaryStub.retrieveInstanceFrames.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    )
    secondaryStub.retrieveInstanceFrames.mockResolvedValue([
      'frame-from-secondary',
    ])

    const frames = await manager.retrieveInstanceFrames({
      studyInstanceUID: '1.2.3',
      seriesInstanceUID: '1.2.3.B',
      sopInstanceUID: '1.2.3.B.1',
      frameNumbers: [1],
    } as dwc.api.RetrieveInstanceFramesOptions)

    expect(primaryStub.retrieveInstanceFrames).toHaveBeenCalledTimes(1)
    expect(secondaryStub.retrieveInstanceFrames).toHaveBeenCalledTimes(1)
    expect(frames).toEqual(['frame-from-secondary'])
  })

  it('throws the last error when every store fails', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    primaryStub.retrieveBulkData.mockRejectedValue(new Error('first'))
    secondaryStub.retrieveBulkData.mockRejectedValue(new Error('second'))

    await expect(
      manager.retrieveBulkData({
        BulkDataURI: 'https://example.test/bulkdata/1',
      } as unknown as dwc.api.RetrieveBulkDataOptions),
    ).rejects.toThrow('second')
  })
})

describe('DicomWebManager - storeInstances and headers', () => {
  it('routes storeInstances to the first writable store even when it is the secondary', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: true },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    secondaryStub.storeInstances.mockResolvedValue(undefined)

    await manager.storeInstances({
      datasets: [],
    } as dwc.api.StoreInstancesOptions)

    expect(primaryStub.storeInstances).not.toHaveBeenCalled()
    expect(secondaryStub.storeInstances).toHaveBeenCalledTimes(1)
  })

  it('rejects storeInstances when no configured store is writable', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    await expect(
      manager.storeInstances({
        datasets: [],
      } as dwc.api.StoreInstancesOptions),
    ).rejects.toThrow('Store is not writable.')
  })

  it('propagates updateHeaders to every wrapped store', () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        { id: 'secondary', url: 'https://secondary.test/dicomWeb', write: false },
      ],
    })
    manager.setAuthorizationPolicy(allowAllPolicy())

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    manager.updateHeaders({ Authorization: 'Bearer abc' })

    expect(primaryStub.headers.Authorization).toBe('Bearer abc')
    expect(secondaryStub.headers.Authorization).toBe('Bearer abc')
  })

  it('withholds the Authorization header from stores with sendAuthorization: false', () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'primary', url: 'https://primary.test/dicomWeb', write: false },
        {
          id: 'open',
          url: 'https://open.test/dicomWeb',
          write: false,
          sendAuthorization: false,
        },
      ],
    })
    // The primary is in auto mode; approve its origin so it carries the token.
    manager.setAuthorizationPolicy(allowAllPolicy())

    const primaryStub = makeStubClient('primary')
    const openStub = makeStubClient('open')
    stubManagerClients(manager, [primaryStub, openStub])

    manager.updateHeaders({
      Authorization: 'Bearer abc',
      'X-Custom': 'value',
    })

    expect(primaryStub.headers.Authorization).toBe('Bearer abc')
    expect(openStub.headers.Authorization).toBeUndefined()
    // Non-credential headers are still propagated to the open store.
    expect(openStub.headers['X-Custom']).toBe('value')
  })

  it('withholds the token from an unchallenged server until it asks', () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'open', url: 'https://open.test/dicomWeb', write: false }],
    })
    manager.setAuthorizationPolicy(consentPolicy(true))

    const openStub = makeStubClient('open')
    stubManagerClients(manager, [openStub])

    manager.updateHeaders({ Authorization: 'Bearer abc' })

    // Nothing has returned 401, so the server never sees the credential.
    expect(openStub.headers.Authorization).toBeUndefined()
  })

  it('credentials a store immediately when its origin was already approved', () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'gcp', url: 'https://gcp.test/dicomWeb', write: false }],
    })
    const policy = allowAllPolicy()
    manager.setAuthorizationPolicy(policy)

    const gcpStub = makeStubClient('gcp')
    stubManagerClients(manager, [gcpStub])

    manager.updateHeaders({ Authorization: 'Bearer abc' })

    expect(policy.isPreAuthorized).toHaveBeenCalledWith('https://gcp.test')
    expect(gcpStub.headers.Authorization).toBe('Bearer abc')
  })
})

describe('DicomWebManager - authorization escalation', () => {
  it('escalates to an authenticated retry after a 401 and returns the result', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'gcp', url: 'https://gcp.test/dicomWeb', write: false }],
    })
    const policy = consentPolicy(true)
    manager.setAuthorizationPolicy(policy)

    const gcpStub = makeStubClient('gcp')
    stubManagerClients(manager, [gcpStub])

    const study = { '0020000D': { Value: ['1.2.3'] } }
    gcpStub.searchForStudies
      .mockRejectedValueOnce(httpError(401))
      .mockResolvedValueOnce([study])

    const result = await manager.searchForStudies({})

    expect(result).toEqual([study])
    expect(gcpStub.searchForStudies).toHaveBeenCalledTimes(2)
    expect(policy.requestAuthorization).toHaveBeenCalledWith('https://gcp.test')
    expect(gcpStub.headers.Authorization).toBe('Bearer abc')
  })

  it('escalates on 403 as well as 401', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'gcp', url: 'https://gcp.test/dicomWeb', write: false }],
    })
    manager.setAuthorizationPolicy(consentPolicy(true))

    const gcpStub = makeStubClient('gcp')
    stubManagerClients(manager, [gcpStub])

    gcpStub.retrieveInstance
      .mockRejectedValueOnce(httpError(403))
      .mockResolvedValueOnce(new ArrayBuffer(0))

    await manager
      .retrieveInstance({} as dwc.api.RetrieveInstanceOptions)
      .catch(() => undefined)

    expect(gcpStub.retrieveInstance).toHaveBeenCalledTimes(2)
    expect(gcpStub.headers.Authorization).toBe('Bearer abc')
  })

  it('never sends the token when consent is refused', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        { id: 'untrusted', url: 'https://untrusted.test/dicomWeb', write: false },
      ],
    })
    manager.setAuthorizationPolicy(consentPolicy(false))

    const stub = makeStubClient('untrusted')
    stubManagerClients(manager, [stub])

    stub.searchForStudies.mockRejectedValue(httpError(401))

    const result = await manager.searchForStudies({})

    expect(result).toEqual([])
    // One attempt only: no retry, and the credential was never attached.
    expect(stub.searchForStudies).toHaveBeenCalledTimes(1)
    expect(stub.headers.Authorization).toBeUndefined()
  })

  it('does not escalate a store configured with sendAuthorization: false', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        {
          id: 'open',
          url: 'https://open.test/dicomWeb',
          write: false,
          sendAuthorization: false,
        },
      ],
    })
    const policy = consentPolicy(true)
    manager.setAuthorizationPolicy(policy)

    const stub = makeStubClient('open')
    stubManagerClients(manager, [stub])

    stub.searchForStudies.mockRejectedValue(httpError(401))

    await manager.searchForStudies({})

    expect(policy.requestAuthorization).not.toHaveBeenCalled()
    expect(stub.headers.Authorization).toBeUndefined()
  })

  it('asks once per origin when concurrent requests are refused together', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'gcp', url: 'https://gcp.test/dicomWeb', write: false }],
    })
    const policy = consentPolicy(true)
    manager.setAuthorizationPolicy(policy)

    const gcpStub = makeStubClient('gcp')
    stubManagerClients(manager, [gcpStub])

    gcpStub.searchForStudies.mockRejectedValueOnce(httpError(401))
    gcpStub.searchForSeries.mockRejectedValueOnce(httpError(401))
    gcpStub.searchForInstances.mockRejectedValueOnce(httpError(401))
    gcpStub.searchForStudies.mockResolvedValue([])
    gcpStub.searchForSeries.mockResolvedValue([])
    gcpStub.searchForInstances.mockResolvedValue([])

    await Promise.all([
      manager.searchForStudies({}),
      manager.searchForSeries({}),
      manager.searchForInstances({}),
    ])

    // Three simultaneous challenges, one consent prompt.
    expect(policy.requestAuthorization).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 404, which is not an authorization challenge', async () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'gcp', url: 'https://gcp.test/dicomWeb', write: false }],
    })
    const policy = consentPolicy(true)
    manager.setAuthorizationPolicy(policy)

    const gcpStub = makeStubClient('gcp')
    stubManagerClients(manager, [gcpStub])

    gcpStub.searchForStudies.mockRejectedValue(httpError(404))

    await manager.searchForStudies({})

    expect(gcpStub.searchForStudies).toHaveBeenCalledTimes(1)
    expect(policy.requestAuthorization).not.toHaveBeenCalled()
  })

  it('leaves a store permanently anonymous when no policy is installed', () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'gcp', url: 'https://gcp.test/dicomWeb', write: false }],
    })

    const gcpStub = makeStubClient('gcp')
    stubManagerClients(manager, [gcpStub])

    manager.updateHeaders({ Authorization: 'Bearer abc' })

    expect(gcpStub.headers.Authorization).toBeUndefined()
  })

  it('reapplies the current token to stores approved after the fact', () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [{ id: 'gcp', url: 'https://gcp.test/dicomWeb', write: false }],
    })

    const gcpStub = makeStubClient('gcp')
    stubManagerClients(manager, [gcpStub])

    // Token arrives before the policy is installed.
    manager.updateHeaders({ Authorization: 'Bearer abc' })
    expect(gcpStub.headers.Authorization).toBeUndefined()

    manager.setAuthorizationPolicy(allowAllPolicy())
    expect(gcpStub.headers.Authorization).toBe('Bearer abc')
  })

  it('matches the Authorization header case-insensitively when withholding it', () => {
    const manager = new DicomWebManager({
      baseUri,
      settings: [
        {
          id: 'open',
          url: 'https://open.test/dicomWeb',
          write: false,
          sendAuthorization: false,
        },
      ],
    })

    const openStub = makeStubClient('open')
    stubManagerClients(manager, [openStub])

    manager.updateHeaders({ authorization: 'Bearer abc' })

    expect(openStub.headers.authorization).toBeUndefined()
  })
})

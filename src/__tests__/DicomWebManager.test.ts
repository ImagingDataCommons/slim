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

    const primaryStub = makeStubClient('primary')
    const secondaryStub = makeStubClient('secondary')
    stubManagerClients(manager, [primaryStub, secondaryStub])

    manager.updateHeaders({ Authorization: 'Bearer abc' })

    expect(primaryStub.headers.Authorization).toBe('Bearer abc')
    expect(secondaryStub.headers.Authorization).toBe('Bearer abc')
  })
})

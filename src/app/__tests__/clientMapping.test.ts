import type { ServerSettings } from '../../AppConfig'
import DicomWebManager, {
  type AuthorizationPolicy,
} from '../../DicomWebManager'
import { StorageClasses } from '../../data/uids'
import NotificationMiddleware from '../../services/NotificationMiddleware'
import {
  addGcpSecondaryAnnotationServer,
  applyAuthorizationPolicy,
  collectConfiguredOrigins,
  createClientMapping,
  DEFAULT_GCP_BASE_URL,
  GCP_SECONDARY_SERVER_ID,
  mapAllStorageClasses,
  resolveCustomServerUrl,
  updateAuthorization,
} from '../clientMapping'

const BASE_URI = 'http://localhost'
const PRIMARY_URL = 'https://dicom.example.com/dicomWeb'
const SECONDARY_URL = 'https://annotations.example.com/dicomWeb'

const primary = (): ServerSettings => ({
  id: 'primary',
  url: PRIMARY_URL,
  write: false,
})

const createMapping = (
  settings: ServerSettings[],
  pathname = '/',
): ReturnType<typeof createClientMapping> =>
  createClientMapping({
    baseUri: BASE_URI,
    gcpBaseUrl: DEFAULT_GCP_BASE_URL,
    settings,
    pathname,
    onError: vi.fn(),
  })

describe('addGcpSecondaryAnnotationServer', () => {
  it('appends the ?gcp= store for derived data', () => {
    const config = { servers: [primary()] }
    addGcpSecondaryAnnotationServer(config, `?gcp=${SECONDARY_URL}`)

    expect(config.servers).toHaveLength(2)
    expect(config.servers[1]).toEqual(
      expect.objectContaining({
        id: GCP_SECONDARY_SERVER_ID,
        url: SECONDARY_URL,
        write: true,
      }),
    )
    expect(config.servers[1].storageClasses).toContain(
      StorageClasses.COMPREHENSIVE_SR,
    )
    expect(config.servers[1].storageClasses).not.toContain(
      StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE,
    )
  })

  it('appends it only once', () => {
    const config = { servers: [primary()] }
    addGcpSecondaryAnnotationServer(config, `?gcp=${SECONDARY_URL}`)
    addGcpSecondaryAnnotationServer(config, `?gcp=${SECONDARY_URL}`)
    expect(config.servers).toHaveLength(2)
  })

  it('does nothing without the parameter', () => {
    const config = { servers: [primary()] }
    addGcpSecondaryAnnotationServer(config, '?state=1')
    expect(config.servers).toHaveLength(1)
  })
})

describe('createClientMapping', () => {
  beforeEach(() => {
    vi.spyOn(NotificationMiddleware, 'onError').mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps every storage class to the default server', () => {
    const mapping = createMapping([primary()])

    expect(mapping.default.baseURL).toBe(PRIMARY_URL)
    for (const sopClassUID of Object.values(StorageClasses)) {
      expect(mapping[sopClassUID]).toBe(mapping.default)
    }
  })

  it('reads derived data from both the default and the specialty store', () => {
    const config = { servers: [primary()] }
    addGcpSecondaryAnnotationServer(config, `?gcp=${SECONDARY_URL}`)
    const mapping = createMapping(config.servers)

    const srClient = mapping[StorageClasses.COMPREHENSIVE_SR]
    expect(srClient).not.toBe(mapping.default)
    expect(srClient.baseURL).toBe(PRIMARY_URL)
    expect(mapping[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]).toBe(
      mapping.default,
    )
  })

  it('points the default server at the store of a /projects/ route', () => {
    const server = primary()
    createMapping(
      [server],
      '/projects/p/locations/l/datasets/d/dicomStores/s/study/1.2.3',
    )
    expect(server.url).toBe(
      `${DEFAULT_GCP_BASE_URL}/projects/p/locations/l/datasets/d/dicomStores/s/dicomWeb`,
    )
  })

  it('reports more than one default server', () => {
    createMapping([primary(), { ...primary(), id: 'other' }])
    expect(NotificationMiddleware.onError).toHaveBeenCalledTimes(1)
  })

  it('warns about unknown storage classes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(vi.fn())
    createMapping([primary(), { ...primary(), storageClasses: ['1.2.3'] }])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown storage class "1.2.3"'),
    )
  })
})

describe('collectConfiguredOrigins', () => {
  it('uses the server origin, or the app origin for path-only servers', () => {
    expect(
      collectConfiguredOrigins(
        [primary(), { id: 'local', path: '/dicomweb', write: false }],
        BASE_URI,
      ),
    ).toEqual(new Set(['https://dicom.example.com', BASE_URI]))
  })
})

describe('resolveCustomServerUrl', () => {
  it.each([
    ['', null, undefined],
    ['   ', 'custom', undefined],
    [PRIMARY_URL, 'default', undefined],
    [` ${PRIMARY_URL} `, 'custom', PRIMARY_URL],
    [PRIMARY_URL, null, PRIMARY_URL],
  ])('resolves %p in mode %p to %p', (url, mode, expected) => {
    expect(resolveCustomServerUrl(url, mode)).toBe(expected)
  })
})

describe('client helpers', () => {
  const createClient = (url: string): DicomWebManager =>
    new DicomWebManager({
      baseUri: BASE_URI,
      settings: [{ id: url, url, write: false }],
    })

  it('maps every key to one client', () => {
    const replacement = createClient(SECONDARY_URL)
    const mapped = mapAllStorageClasses(createMapping([primary()]), replacement)
    expect(new Set(Object.values(mapped))).toEqual(new Set([replacement]))
    expect(Object.keys(mapped)).toContain('default')
  })

  it('installs the policy once per distinct client', () => {
    const mapping = createMapping([primary()])
    const setPolicy = vi.spyOn(mapping.default, 'setAuthorizationPolicy')
    const policy: AuthorizationPolicy = {
      isPreAuthorized: () => false,
      requestAuthorization: () => Promise.resolve(undefined),
    }
    applyAuthorizationPolicy(mapping, policy)
    expect(setPolicy).toHaveBeenCalledTimes(1)
    expect(setPolicy).toHaveBeenCalledWith(policy)
  })

  it('offers the token to every mapped client', () => {
    const mapping = createMapping([primary()])
    const updateHeaders = vi.spyOn(mapping.default, 'updateHeaders')
    updateAuthorization(mapping, 'Bearer t')
    expect(updateHeaders).toHaveBeenCalledWith({ Authorization: 'Bearer t' })
  })
})

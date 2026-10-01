import { isValidServerUrl } from '../serverUrl'

const storePath =
  '/projects/my-project/locations/us-central1/datasets/my-dataset/dicomStores/my-store'

describe('isValidServerUrl', () => {
  it('rejects empty input', () => {
    expect(isValidServerUrl(undefined)).toBe(false)
    expect(isValidServerUrl(null)).toBe(false)
    expect(isValidServerUrl('')).toBe(false)
    expect(isValidServerUrl('   ')).toBe(false)
  })

  it('accepts HTTP(S) URLs with a path', () => {
    expect(isValidServerUrl('https://example.org/dicomweb')).toBe(true)
    expect(isValidServerUrl('http://localhost:8008/dcm4chee/rs')).toBe(true)
    expect(isValidServerUrl('  https://example.org/dicomweb/  ')).toBe(true)
  })

  it('rejects a bare origin', () => {
    expect(isValidServerUrl('https://example.org')).toBe(false)
    expect(isValidServerUrl('https://example.org/')).toBe(false)
    expect(isValidServerUrl('http://localhost:8008')).toBe(false)
  })

  it('rejects malformed URLs and other schemes', () => {
    expect(isValidServerUrl('https://')).toBe(false)
    expect(isValidServerUrl('ftp://example.org/dicomweb')).toBe(false)
    expect(isValidServerUrl('example.org/dicomweb')).toBe(false)
  })

  it('accepts GCP DICOM store paths with or without a leading slash', () => {
    expect(isValidServerUrl(storePath)).toBe(true)
    expect(isValidServerUrl(storePath.slice(1))).toBe(true)
    expect(isValidServerUrl(`${storePath}/dicomWeb`)).toBe(true)
  })

  it('rejects incomplete GCP paths', () => {
    expect(isValidServerUrl('/projects/my-project')).toBe(false)
    expect(isValidServerUrl('/projects/p/locations/l/datasets/d')).toBe(false)
  })
})

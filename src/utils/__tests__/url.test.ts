import { GCP_HEALTHCARE_V1_BASE, normalizeServerUrl } from '../url'

const storePath =
  '/projects/idc-sandbox-000/locations/us-central1/datasets/fedorov-dev-healthcare/dicomStores/sardana-lut-test'

const expectedUrl = `${GCP_HEALTHCARE_V1_BASE}${storePath}/dicomWeb`

describe('normalizeServerUrl', () => {
  it('prepends the GCP base for path-only store URLs', () => {
    expect(normalizeServerUrl(`${storePath}/dicomWeb`)).toBe(expectedUrl)
  })

  it('appends /dicomWeb when a GCP store path omits it', () => {
    expect(normalizeServerUrl(storePath)).toBe(expectedUrl)
    expect(
      normalizeServerUrl(
        'projects/idc-sandbox-000/locations/us-central1/datasets/fedorov-dev-healthcare/dicomStores/sardana-lut-test',
      ),
    ).toBe(expectedUrl)
  })

  it('appends /dicomWeb for full GCP URLs that omit it', () => {
    expect(
      normalizeServerUrl(`https://healthcare.googleapis.com/v1${storePath}`),
    ).toBe(expectedUrl)
  })

  it('does not duplicate /dicomWeb when already present', () => {
    const fullUrl = `https://healthcare.googleapis.com/v1${storePath}/dicomWeb`
    expect(normalizeServerUrl(fullUrl)).toBe(fullUrl)
    expect(normalizeServerUrl(`${storePath}/dicomWeb/`)).toBe(expectedUrl)
  })

  it('deduplicates repeated /dicomWeb segments', () => {
    expect(normalizeServerUrl(`${storePath}/dicomWeb/dicomWeb`)).toBe(
      expectedUrl,
    )
    expect(
      normalizeServerUrl(
        `https://healthcare.googleapis.com/v1${storePath}/dicomWeb/dicomWeb`,
      ),
    ).toBe(expectedUrl)
  })

  it('normalizes /dicomWeb casing to the canonical GCP suffix', () => {
    expect(normalizeServerUrl(`${storePath}/dicomweb`)).toBe(expectedUrl)
    expect(normalizeServerUrl(`${storePath}/DICOMWEB`)).toBe(expectedUrl)
  })

  it('preserves query parameters on full URLs', () => {
    expect(
      normalizeServerUrl(
        `https://healthcare.googleapis.com/v1${storePath}?alt=json`,
      ),
    ).toBe(`${expectedUrl}?alt=json`)
  })

  it('does not append /dicomWeb for non-GCP servers', () => {
    const proxyUrl =
      'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb'
    expect(normalizeServerUrl(proxyUrl)).toBe(proxyUrl)
  })
})

import {
  buildSeriesSelectionPath,
  defaultSeriesRedirectPath,
} from '../seriesPath'

const GCP_STUDY = '/projects/p/locations/l/datasets/d/dicomStores/s/study/1.2.3'

describe('buildSeriesSelectionPath', () => {
  it('builds a study series path and keeps the query of series routes', () => {
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3/series/9.9',
        search: '?state=7',
      }),
    ).toBe('/studies/1.2.3/series/4.5?state=7')
  })

  it('drops the query when the current route has no series', () => {
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3',
        search: '?state=7',
      }),
    ).toBe('/studies/1.2.3/series/4.5')
  })

  it('keeps the GCP store prefix', () => {
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '4.5',
        pathname: `${GCP_STUDY}/series/9.9`,
        search: '',
      }),
    ).toBe(`${GCP_STUDY}/series/4.5`)
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '4.5',
        pathname: GCP_STUDY,
        search: '',
      }),
    ).toBe(`${GCP_STUDY}/series/4.5`)
  })
})

describe('defaultSeriesRedirectPath', () => {
  it('redirects a study route to the default series', () => {
    expect(
      defaultSeriesRedirectPath({
        studyInstanceUID: '1.2.3',
        defaultSeriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3',
        search: '',
        hash: '',
      }),
    ).toBe('/studies/1.2.3/series/4.5')
  })

  it('keeps the query and hash of the study route', () => {
    expect(
      defaultSeriesRedirectPath({
        studyInstanceUID: '1.2.3',
        defaultSeriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3',
        search: '?gcp=https%3A%2F%2Fstore.example&access_token=abc',
        hash: '#panel',
      }),
    ).toBe(
      '/studies/1.2.3/series/4.5?gcp=https%3A%2F%2Fstore.example&access_token=abc#panel',
    )
  })

  it('keeps the GCP store prefix and query', () => {
    expect(
      defaultSeriesRedirectPath({
        studyInstanceUID: '1.2.3',
        defaultSeriesInstanceUID: '4.5',
        pathname: GCP_STUDY,
        search: '?gcp=x',
        hash: '',
      }),
    ).toBe(`${GCP_STUDY}/series/4.5?gcp=x`)
  })

  it('does not redirect routes that already name a series', () => {
    expect(
      defaultSeriesRedirectPath({
        studyInstanceUID: '1.2.3',
        defaultSeriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3/series/9.9',
        search: '?gcp=x',
        hash: '',
      }),
    ).toBeUndefined()
  })

  it('does not redirect without a default series', () => {
    expect(
      defaultSeriesRedirectPath({
        studyInstanceUID: '1.2.3',
        defaultSeriesInstanceUID: undefined,
        pathname: '/studies/1.2.3',
        search: '?gcp=x',
        hash: '',
      }),
    ).toBeUndefined()
  })
})

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
        search: '?gcp=projects/p/x&view=a%2Bb',
      }),
    ).toBe('/studies/1.2.3/series/4.5?gcp=projects/p/x&view=a%2Bb')
  })

  it('drops a sign-in response the router still holds', () => {
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '9.9',
        pathname: '/studies/1.2.3/series/9.9',
        search: '?gcp=projects/p/x&code=abc&state=nonce&session_state=s',
      }),
    ).toBe('/studies/1.2.3/series/9.9?gcp=projects/p/x')
  })

  it("leaves another slide's presentation state behind", () => {
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3/series/9.9',
        search: '?gcp=projects/p/x&state=7',
      }),
    ).toBe('/studies/1.2.3/series/4.5?gcp=projects/p/x')
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3/series/9.9',
        search: '?state=7',
      }),
    ).toBe('/studies/1.2.3/series/4.5')
  })

  it('keeps the presentation state when the same series is selected', () => {
    expect(
      buildSeriesSelectionPath({
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3/series/4.5',
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
        search: '?gcp=https%3A%2F%2Fstore.example',
        hash: '#panel',
      }),
    ).toBe('/studies/1.2.3/series/4.5?gcp=https%3A%2F%2Fstore.example#panel')
  })

  it('drops a sign-in response from the query and the hash', () => {
    expect(
      defaultSeriesRedirectPath({
        studyInstanceUID: '1.2.3',
        defaultSeriesInstanceUID: '4.5',
        pathname: '/studies/1.2.3',
        search: '?gcp=x&access_token=abc&token_type=Bearer',
        hash: '#id_token=t&state=s',
      }),
    ).toBe('/studies/1.2.3/series/4.5?gcp=x')
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

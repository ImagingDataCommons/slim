import {
  buildLogoutPath,
  buildSeriesPath,
  buildStudyPath,
  getProjectStorePath,
  hasSeriesInPath,
  isGcpDicomStorePath,
  isProjectsPath,
  isViewerPath,
  parseSeriesInstanceUID,
  RouteParams,
  RoutePaths,
  withSeriesInProjectPath,
} from '../routes'

const studyUID = '1.2.3'
const seriesUID = '4.5.6'
const otherSeriesUID = '7.8.9'

const gcpStorePath =
  '/projects/idc-sandbox-000/locations/us-central1/datasets/dev/dicomStores/store'

describe('route templates', () => {
  it('embed the configured parameter names', () => {
    expect(RoutePaths.STUDY).toBe(`/studies/:${RouteParams.STUDY_INSTANCE_UID}/*`)
    expect(RoutePaths.SERIES).toBe(
      `/series/:${RouteParams.SERIES_INSTANCE_UID}`,
    )
    expect(RoutePaths.GCP_STUDY).toBe(
      '/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore/study/:studyInstanceUID/*',
    )
    expect(RoutePaths.ROOT).toBe('/')
    expect(RoutePaths.LOGOUT).toBe('/logout')
  })
})

describe('path builders', () => {
  it('builds study paths', () => {
    expect(buildStudyPath(studyUID)).toBe('/studies/1.2.3')
  })

  it('builds series paths', () => {
    expect(buildSeriesPath(studyUID, seriesUID)).toBe(
      '/studies/1.2.3/series/4.5.6',
    )
  })

  it('builds logout paths', () => {
    expect(buildLogoutPath('https://example.org')).toBe(
      'https://example.org/logout',
    )
  })
})

describe('parseSeriesInstanceUID', () => {
  it('returns the series UID at the end of a path', () => {
    expect(parseSeriesInstanceUID('/studies/1.2.3/series/4.5.6')).toBe(seriesUID)
  })

  it('returns the series UID followed by further segments', () => {
    expect(parseSeriesInstanceUID('/studies/1.2.3/series/4.5.6/extra')).toBe(
      seriesUID,
    )
  })

  it('returns an empty string when no series is present', () => {
    expect(parseSeriesInstanceUID('/studies/1.2.3')).toBe('')
  })
})

describe('path predicates', () => {
  it('detects series in a path', () => {
    expect(hasSeriesInPath('/studies/1.2.3/series/4.5.6')).toBe(true)
    expect(hasSeriesInPath('/studies/1.2.3')).toBe(false)
  })

  it('detects GCP project paths', () => {
    expect(isProjectsPath(`${gcpStorePath}/study/1.2.3`)).toBe(true)
    expect(isProjectsPath('/studies/1.2.3')).toBe(false)
  })

  it('detects viewer paths', () => {
    expect(isViewerPath('/studies/1.2.3')).toBe(true)
    expect(isViewerPath(`${gcpStorePath}/study/1.2.3`)).toBe(true)
    expect(isViewerPath('/')).toBe(false)
  })

  it('detects GCP DICOM store paths', () => {
    expect(isGcpDicomStorePath(gcpStorePath)).toBe(true)
    expect(isGcpDicomStorePath('/projects/foo')).toBe(false)
  })
})

describe('getProjectStorePath', () => {
  it('returns the store path up to the study segment', () => {
    expect(getProjectStorePath(`${gcpStorePath}/study/1.2.3`)).toBe(gcpStorePath)
  })
})

describe('withSeriesInProjectPath', () => {
  it('appends a series segment when none is present', () => {
    expect(
      withSeriesInProjectPath(`${gcpStorePath}/study/1.2.3`, seriesUID),
    ).toBe(`${gcpStorePath}/study/1.2.3/series/4.5.6`)
  })

  it('replaces an existing series segment', () => {
    expect(
      withSeriesInProjectPath(
        `${gcpStorePath}/study/1.2.3/series/${otherSeriesUID}`,
        seriesUID,
      ),
    ).toBe(`${gcpStorePath}/study/1.2.3/series/4.5.6`)
  })
})

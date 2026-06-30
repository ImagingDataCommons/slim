/**
 * Centralized routing configuration.
 *
 * Abstracts the URI templates and parameter names that were previously
 * hardcoded across the app, see
 * https://github.com/ImagingDataCommons/slim/issues/48.
 *
 * All route definitions, path construction, and URI parameter parsing should go
 * through this module so the routing scheme can be changed in a single place
 * instead of being duplicated (and re-parsed by hand) in multiple components.
 */

/** Names of the dynamic parameters embedded in the route templates. */
export const RouteParams = {
  STUDY_INSTANCE_UID: 'studyInstanceUID',
  SERIES_INSTANCE_UID: 'seriesInstanceUID',
  PROJECT: 'project',
  LOCATION: 'location',
  DATASET: 'dataset',
  DICOM_STORE: 'dicomStore',
} as const

/** Path segments used to build and recognize routes. */
const Segments = {
  studies: 'studies',
  series: 'series',
  logout: 'logout',
  // GCP Healthcare DICOM store path segments.
  projects: 'projects',
  locations: 'locations',
  datasets: 'datasets',
  dicomStores: 'dicomStores',
  study: 'study',
} as const

/**
 * Route templates consumed by react-router `<Route path>` definitions.
 * `:name` placeholders correspond to entries in `RouteParams`.
 */
export const RoutePaths = {
  /** Worklist / landing page. */
  ROOT: '/',
  /** Study viewer (DICOMweb). Trailing `/*` enables nested series routes. */
  STUDY: `/${Segments.studies}/:${RouteParams.STUDY_INSTANCE_UID}/*`,
  /** Study viewer addressed via a GCP Healthcare DICOM store path. */
  GCP_STUDY:
    `/${Segments.projects}/:${RouteParams.PROJECT}` +
    `/${Segments.locations}/:${RouteParams.LOCATION}` +
    `/${Segments.datasets}/:${RouteParams.DATASET}` +
    `/${Segments.dicomStores}/:${RouteParams.DICOM_STORE}` +
    `/${Segments.study}/:${RouteParams.STUDY_INSTANCE_UID}/*`,
  /** Series viewer, nested under a study route. */
  SERIES: `/${Segments.series}/:${RouteParams.SERIES_INSTANCE_UID}`,
  /** Post-logout landing page. */
  LOGOUT: `/${Segments.logout}`,
} as const

const SERIES_PREFIX = `${Segments.series}/`
const SERIES_PATH_PREFIX = `/${Segments.series}/`
const PROJECTS_PATH_PREFIX = `/${Segments.projects}/`
const STUDY_PATH_PREFIX = `/${Segments.study}/`
const SERIES_SEGMENT_PATTERN = new RegExp(`/${Segments.series}/[^/]+`)

/** Builds the absolute path to a study's viewer. */
export const buildStudyPath = (studyInstanceUID: string): string =>
  `/${Segments.studies}/${studyInstanceUID}`

/** Builds the absolute path to a series within a study's viewer. */
export const buildSeriesPath = (
  studyInstanceUID: string,
  seriesInstanceUID: string,
): string =>
  `${buildStudyPath(studyInstanceUID)}/${Segments.series}/${seriesInstanceUID}`

/** Builds the absolute logout path for a given base URI. */
export const buildLogoutPath = (baseUri: string): string =>
  `${baseUri}/${Segments.logout}`

/** Whether a pathname encodes a series segment. */
export const hasSeriesInPath = (pathname: string): boolean =>
  pathname.includes(SERIES_PATH_PREFIX)

/** Whether a pathname is a GCP DICOM store ("projects") path. */
export const isProjectsPath = (pathname: string): boolean =>
  pathname.includes(PROJECTS_PATH_PREFIX)

/**
 * Extracts the SeriesInstanceUID from a pathname, or '' when none is present.
 * Handles both `.../series/<uid>` and `.../series/<uid>/...` forms.
 */
export const parseSeriesInstanceUID = (pathname: string): string => {
  if (!pathname.includes(SERIES_PREFIX)) {
    return ''
  }
  const seriesFragment = pathname.split(SERIES_PREFIX)[1]
  return seriesFragment.includes('/')
    ? seriesFragment.split('/')[0]
    : seriesFragment
}

/**
 * Returns the portion of a GCP project pathname up to (but excluding) the
 * `/study/` segment. Used to derive the DICOMweb base URL from the URL.
 */
export const getProjectStorePath = (pathname: string): string =>
  pathname.split(STUDY_PATH_PREFIX)[0]

/**
 * Replaces the series segment in a GCP project pathname, or appends one when the
 * pathname does not yet encode a series.
 */
export const withSeriesInProjectPath = (
  pathname: string,
  seriesInstanceUID: string,
): string => {
  if (!hasSeriesInPath(pathname)) {
    return `${pathname}${SERIES_PATH_PREFIX}${seriesInstanceUID}`
  }
  return pathname.replace(
    SERIES_SEGMENT_PATTERN,
    `${SERIES_PATH_PREFIX}${seriesInstanceUID}`,
  )
}

/** Path prefixes for which the DICOM Tag Browser button is shown. */
export const DICOM_TAG_BROWSER_PATHS = [
  `/${Segments.studies}/`,
  `/${Segments.study}/`,
  `/${Segments.projects}/`,
] as const

/** Whether the current pathname corresponds to a study/series viewer. */
export const isViewerPath = (pathname: string): boolean =>
  DICOM_TAG_BROWSER_PATHS.some((path) => pathname.includes(path))

/**
 * Whether a string looks like a GCP Healthcare DICOM store path, i.e. it
 * contains the projects/locations/datasets/dicomStores segments.
 */
export const isGcpDicomStorePath = (pathname: string): boolean =>
  pathname.includes(PROJECTS_PATH_PREFIX) &&
  pathname.includes(`/${Segments.locations}/`) &&
  pathname.includes(`/${Segments.datasets}/`) &&
  pathname.includes(`/${Segments.dicomStores}/`)

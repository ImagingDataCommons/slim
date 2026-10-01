import {
  buildSeriesPath,
  hasSeriesInPath,
  isProjectsPath,
  parseSeriesInstanceUID,
  withSeriesInProjectPath,
} from '../../../utils/routes'

export interface SeriesPathParams {
  studyInstanceUID: string
  seriesInstanceUID: string
  pathname: string
  search: string
}

/** Series path of the current study; GCP store paths keep their prefix */
function seriesPathname({
  studyInstanceUID,
  seriesInstanceUID,
  pathname,
}: Omit<SeriesPathParams, 'search'>): string {
  return isProjectsPath(pathname)
    ? withSeriesInProjectPath(pathname, seriesInstanceUID)
    : buildSeriesPath(studyInstanceUID, seriesInstanceUID)
}

/**
 * Viewer URL for a series of the current study. The query string is only
 * carried over from series routes.
 */
export function buildSeriesSelectionPath(params: SeriesPathParams): string {
  const path = seriesPathname(params)
  return hasSeriesInPath(params.pathname) ? `${path}${params.search}` : path
}

/**
 * Path to redirect a study route without a series to, or `undefined` when the
 * route already names a series or the study has no default series.
 *
 * Keeps the query and hash: `?gcp=` routes derived data to a secondary store
 * and `?access_token=` may carry the credentials, so dropping them changes
 * which servers the viewer talks to and how.
 */
export function defaultSeriesRedirectPath({
  defaultSeriesInstanceUID,
  search,
  hash,
  ...params
}: Omit<SeriesPathParams, 'seriesInstanceUID'> & {
  hash: string
  defaultSeriesInstanceUID: string | undefined
}): string | undefined {
  if (defaultSeriesInstanceUID === undefined) return undefined
  if (parseSeriesInstanceUID(params.pathname) !== '') return undefined
  const path = seriesPathname({
    ...params,
    seriesInstanceUID: defaultSeriesInstanceUID,
  })
  return `${path}${search}${hash}`
}

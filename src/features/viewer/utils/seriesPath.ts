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

/**
 * Viewer URL for a series of the current study. GCP store paths keep their
 * prefix; the query string is only carried over from series routes.
 */
export function buildSeriesSelectionPath({
  studyInstanceUID,
  seriesInstanceUID,
  pathname,
  search,
}: SeriesPathParams): string {
  const path = isProjectsPath(pathname)
    ? withSeriesInProjectPath(pathname, seriesInstanceUID)
    : buildSeriesPath(studyInstanceUID, seriesInstanceUID)
  return hasSeriesInPath(pathname) ? `${path}${search}` : path
}

/**
 * Path to redirect a study route without a series to, or `undefined` when the
 * route already names a series or the study has no default series.
 */
export function defaultSeriesRedirectPath({
  defaultSeriesInstanceUID,
  ...params
}: Omit<SeriesPathParams, 'seriesInstanceUID'> & {
  defaultSeriesInstanceUID: string | undefined
}): string | undefined {
  if (defaultSeriesInstanceUID === undefined) return undefined
  if (parseSeriesInstanceUID(params.pathname) !== '') return undefined
  return buildSeriesSelectionPath({
    ...params,
    seriesInstanceUID: defaultSeriesInstanceUID,
  })
}

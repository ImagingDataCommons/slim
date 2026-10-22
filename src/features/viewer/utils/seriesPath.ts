import {
  hashWithoutAuthResponse,
  searchWithoutAuthResponse,
} from '../../../auth/oidcUser'
import {
  buildSeriesPath,
  hasSeriesInPath,
  isProjectsPath,
  parseSeriesInstanceUID,
  withSeriesInProjectPath,
} from '../../../utils/routes'
import { editSearch } from '../../../utils/url'

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
 * carried over from series routes, and a presentation state (`?state=`)
 * only to the same series: it belongs to the slide it was applied to.
 */
export function buildSeriesSelectionPath(params: SeriesPathParams): string {
  const path = seriesPathname(params)
  if (!hasSeriesInPath(params.pathname)) return path
  const search = searchWithoutAuthResponse(params.search)
  if (parseSeriesInstanceUID(params.pathname) === params.seriesInstanceUID) {
    return `${path}${search}`
  }
  return `${path}${editSearch(search, { remove: ['state'] })}`
}

/**
 * Path to redirect a study route without a series to, or `undefined` when the
 * route already names a series or the study has no default series.
 *
 * Keeps the query and hash: `?gcp=` routes derived data to a secondary store,
 * so dropping it changes which servers the viewer talks to. A sign-in
 * response is dropped: the viewer renders only once sign-in has consumed it,
 * and writing it back would replay the callback on reload.
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
  return `${path}${searchWithoutAuthResponse(search)}${hashWithoutAuthResponse(hash)}`
}

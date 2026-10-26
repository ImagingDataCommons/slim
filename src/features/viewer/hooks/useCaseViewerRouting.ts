import { useEffect } from 'react'
import type { Location, NavigateFunction } from 'react-router'
import { logger } from '../../../utils/logger'
import {
  buildSeriesSelectionPath,
  defaultSeriesRedirectPath,
} from '../utils/seriesPath'

export interface UseCaseViewerRoutingInput {
  isLoading: boolean
  error: Error | null
  studyInstanceUID: string
  defaultSeriesInstanceUID: string | undefined
  location: Location
  navigate: NavigateFunction
}

/**
 * Redirects a bare study URL to its first series, and builds the path used
 * when the user picks another slide from the list.
 */
export function useCaseViewerRouting({
  isLoading,
  error,
  studyInstanceUID,
  defaultSeriesInstanceUID,
  location,
  navigate,
}: UseCaseViewerRoutingInput): {
  handleSeriesSelection: (change: { seriesInstanceUID: string }) => void
} {
  useEffect(() => {
    if (isLoading || error !== null) return
    const redirectPath = defaultSeriesRedirectPath({
      studyInstanceUID,
      defaultSeriesInstanceUID,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    })
    if (redirectPath !== undefined) navigate(redirectPath, { replace: true })
  }, [
    isLoading,
    error,
    studyInstanceUID,
    defaultSeriesInstanceUID,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ])

  return {
    handleSeriesSelection: ({ seriesInstanceUID }) => {
      logger.log(`switch to series "${seriesInstanceUID}"`)
      navigate(
        buildSeriesSelectionPath({
          studyInstanceUID,
          seriesInstanceUID,
          pathname: location.pathname,
          search: location.search,
        }),
        { replace: true },
      )
    },
  }
}

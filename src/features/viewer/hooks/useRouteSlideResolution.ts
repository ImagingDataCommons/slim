import { useEffect, useState } from 'react'
import type { Location, NavigateFunction } from 'react-router'

import type DicomWebManager from '../../../DicomWebManager'
import type { Slide } from '../../../data/slides'
import { logger } from '../../../utils/logger'
import { seriesUidFromSlide } from '../../../utils/recoverSeriesInstanceUID'
import { resolveDerivedSeriesSlide } from '../services/resolveDerivedSeries'
import type { ReferencingInstance } from '../utils/referencedSlide'
import { findSeriesSlide, matchSlideForSeriesRoute } from '../utils/routeSlide'

export interface RouteSlideResolution {
  selectedSlide: Slide | null | undefined
  derivedDataset: ReferencingInstance | null
  /** Series from the URL that resolved to no slide of this study */
  unresolvedSeriesUID: string | null
}

/**
 * Keep the selected image slide in sync with the series route, correcting
 * mangled UIDs and resolving ANN/SEG/SR/… deep links to their referenced slide.
 */
export function useRouteSlideResolution({
  clients,
  slides,
  studyInstanceUID,
  seriesInstanceUID,
  location,
  navigate,
}: {
  clients: { [key: string]: DicomWebManager }
  slides: readonly Slide[]
  studyInstanceUID: string
  seriesInstanceUID: string
  location: Pick<Location, 'pathname' | 'search'>
  navigate: NavigateFunction
}): RouteSlideResolution {
  const [selectedSlide, setSelectedSlide] = useState(
    findSeriesSlide(slides, seriesInstanceUID),
  )
  const [derivedDataset, setDerivedDataset] =
    useState<ReferencingInstance | null>(null)
  const [unresolvedSeriesUID, setUnresolvedSeriesUID] = useState<string | null>(
    null,
  )

  useEffect(() => {
    const match = matchSlideForSeriesRoute({
      slides,
      seriesInstanceUID,
      selectedSlide,
    })

    if (match.kind === 'unchanged') return

    if (match.kind === 'image') {
      setSelectedSlide(match.slide)
      setDerivedDataset(null)
      setUnresolvedSeriesUID(null)
      if (match.correctedSeriesUID !== undefined) {
        logger.warn(
          `Corrected mangled series UID in route: "${seriesInstanceUID}" → "${match.correctedSeriesUID}"`,
        )
        navigate(
          {
            pathname: location.pathname.replace(
              `/series/${seriesInstanceUID}`,
              `/series/${match.correctedSeriesUID}`,
            ),
            search: location.search,
          },
          { replace: true },
        )
      }
      return
    }

    /** Set on cleanup so a superseded lookup cannot select a stale slide */
    let isCancelled = false
    void resolveDerivedSeriesSlide({
      clients,
      slides,
      studyInstanceUID,
      seriesInstanceUID,
    }).then((resolution) => {
      if (isCancelled) return
      if (resolution.kind === 'referenced') {
        setSelectedSlide(resolution.slide)
        setDerivedDataset(resolution.derivedDataset)
        setUnresolvedSeriesUID(null)
        return
      }
      setUnresolvedSeriesUID(seriesInstanceUID)
    })

    return () => {
      isCancelled = true
      return undefined
    }
  }, [
    slides,
    clients,
    studyInstanceUID,
    seriesInstanceUID,
    selectedSlide,
    navigate,
    location.pathname,
    location.search,
  ])

  return { selectedSlide, derivedDataset, unresolvedSeriesUID }
}

/** Canonical series UID for the viewer once a slide is selected. */
export function resolvedSeriesInstanceUID(
  selectedSlide: Slide,
  seriesInstanceUID: string,
): string {
  return seriesUidFromSlide(selectedSlide, seriesInstanceUID)
}

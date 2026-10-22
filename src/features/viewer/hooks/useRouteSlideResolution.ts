import { useEffect, useRef, useState } from 'react'
import type { Location, NavigateFunction } from 'react-router'

import { searchWithoutAuthResponse } from '../../../auth/oidcUser'
import type DicomWebManager from '../../../DicomWebManager'
import type { Slide } from '../../../data/slides'
import { logger } from '../../../utils/logger'
import { seriesUidFromSlide } from '../../../utils/recoverSeriesInstanceUID'
import { resolveDerivedSeriesSlide } from '../services/resolveDerivedSeries'
import type { ReferencingInstance } from '../utils/referencedSlide'
import {
  findSeriesSlide,
  matchSlideForSeriesRoute,
  ROUTE_RECOVERY,
} from '../utils/routeSlide'
import { useLatestRef } from './useLatestRef'

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
  /** Derived series whose referenced slide was already looked up */
  const resolvedDerivedSeriesRef = useRef<string | undefined>(undefined)
  /**
   * Read when correcting the URL, so a query change (such as `?state=`) does
   * not restart a derived-series lookup in flight
   */
  const routingRef = useLatestRef({ location, navigate })

  useEffect(() => {
    const match = matchSlideForSeriesRoute({
      slides,
      seriesInstanceUID,
      selectedSlide,
    })

    if (match.kind === 'unchanged' || match.kind === 'image') {
      /**
       * The route names an image series, so a derived dataset from an
       * earlier deep link must not be shown again.
       */
      resolvedDerivedSeriesRef.current = undefined
      if (match.kind === 'image') setSelectedSlide(match.slide)
      setDerivedDataset(null)
      setUnresolvedSeriesUID(null)
      /** Also on first load, so links copied from the URL are canonical */
      if (match.correctedSeriesUID !== undefined) {
        logger.warn(
          `Corrected mangled series UID in route: "${seriesInstanceUID}" → "${match.correctedSeriesUID}"`,
        )
        const { location: currentLocation, navigate: currentNavigate } =
          routingRef.current
        currentNavigate(
          {
            pathname: currentLocation.pathname.replace(
              `/series/${seriesInstanceUID}`,
              `/series/${match.correctedSeriesUID}`,
            ),
            search: searchWithoutAuthResponse(currentLocation.search),
          },
          { replace: true },
        )
      }
      return
    }

    /** Already resolved for this route; the selectedSlide update re-ran us */
    if (resolvedDerivedSeriesRef.current === seriesInstanceUID) return
    /** Another derived series' dataset must not be shown while this resolves */
    setDerivedDataset(null)

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
        resolvedDerivedSeriesRef.current = seriesInstanceUID
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
    routingRef,
  ])

  /**
   * The slide of an image series route is known while rendering; using it
   * at once keeps the viewers from being built for the previous slide in
   * the render before the effect selects it.
   */
  const routeImageSlide = findSeriesSlide(slides, seriesInstanceUID)
  return {
    selectedSlide: routeImageSlide ?? selectedSlide,
    derivedDataset,
    unresolvedSeriesUID,
  }
}

/** Canonical series UID for the viewer once a slide is selected. */
export function resolvedSeriesInstanceUID(
  selectedSlide: Slide,
  seriesInstanceUID: string,
): string {
  /** Matched like the route, so a derived series is not taken for its slide */
  return seriesUidFromSlide(selectedSlide, seriesInstanceUID, ROUTE_RECOVERY)
}

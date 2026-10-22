import { isAuthResponse } from '../../../auth/oidcUser'
import type { Slide } from '../../../data/slides'
import {
  findSlideBySeriesInstanceUID,
  recoverSeriesInstanceUID,
} from '../../../utils/recoverSeriesInstanceUID'
import { parseSeriesInstanceUID } from '../../../utils/routes'

/**
 * Route recovery only undoes the trailing `.0` of menu key mangling: a
 * longer UID that extends a slide series may be a derived series named
 * after it, which must be looked up, not shown as the slide.
 */
const ROUTE_RECOVERY = { allowPrefix: false }

/** Slide whose series list includes `seriesInstanceUID` (or a mangled form). */
export function findSeriesSlide(
  slides: readonly Slide[],
  seriesInstanceUID: string,
): Slide | undefined {
  return findSlideBySeriesInstanceUID(slides, seriesInstanceUID, ROUTE_RECOVERY)
}

/** Canonical series UID of `slide` for a route UID, if it is one of them */
function canonicalRouteSeriesUID(
  slide: { seriesInstanceUIDs: string[] },
  seriesInstanceUID: string,
): string | undefined {
  return recoverSeriesInstanceUID(
    seriesInstanceUID,
    slide.seriesInstanceUIDs,
    ROUTE_RECOVERY,
  )
}

/**
 * Presentation state from `?state=`, ignored on a sign-in callback so its
 * OAuth `state` cannot be mistaken for a PR UID.
 */
export function presentationStateUIDFromSearch(
  search: string,
): string | undefined {
  const searchParams = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  if (isAuthResponse(searchParams)) return undefined
  const stateParam = searchParams.get('state')
  return stateParam !== null ? stateParam : undefined
}

/**
 * Series UID to highlight in the slide list: corrected from the path when it
 * matches a slide, otherwise the path value or the first volume series.
 */
export function selectedSeriesForStudyPath({
  slides,
  pathname,
  fallbackSeriesInstanceUID,
}: {
  slides: readonly Slide[]
  pathname: string
  fallbackSeriesInstanceUID: string
}): string {
  const seriesFromPath = parseSeriesInstanceUID(pathname)
  if (seriesFromPath === '') return fallbackSeriesInstanceUID
  /** Matched like the viewer route, so both agree on the slide */
  const slideForPath = findSeriesSlide(slides, seriesFromPath)
  return slideForPath !== undefined
    ? (canonicalRouteSeriesUID(slideForPath, seriesFromPath) ?? seriesFromPath)
    : seriesFromPath
}

/**
 * Pathname with a mangled series UID of `slide` replaced by its canonical
 * UID, so the URL correction does not count as a new route. Derived series
 * (not series of the slide) keep their own UID.
 */
export function canonicalSeriesPathname(
  pathname: string,
  slide: { seriesInstanceUIDs: string[] },
): string {
  const seriesFromPath = parseSeriesInstanceUID(pathname)
  if (seriesFromPath === '') return pathname
  const recovered = canonicalRouteSeriesUID(slide, seriesFromPath)
  if (recovered === undefined || recovered === seriesFromPath) return pathname
  return pathname.replace(`/series/${seriesFromPath}`, `/series/${recovered}`)
}

export type SyncRouteSlideMatch =
  | {
      kind: 'unchanged'
      /** Canonical series UID when the route was mangled */
      correctedSeriesUID?: string
    }
  | {
      kind: 'image'
      slide: Slide
      /** Canonical series UID when the route was mangled */
      correctedSeriesUID?: string
    }
  | { kind: 'lookupDerived' }

/**
 * Resolve a route series against the study's image slides without network I/O.
 * `lookupDerived` means the series is not an SM slide and may be a referencing
 * derived series (ANN/SEG/SR/…).
 */
export function matchSlideForSeriesRoute({
  slides,
  seriesInstanceUID,
  selectedSlide,
}: {
  slides: readonly Slide[]
  seriesInstanceUID: string
  selectedSlide: Slide | null | undefined
}): SyncRouteSlideMatch {
  const correction = (slide: Slide): string | undefined => {
    const canonical = canonicalRouteSeriesUID(slide, seriesInstanceUID)
    return canonical !== seriesInstanceUID ? canonical : undefined
  }

  if (
    selectedSlide != null &&
    findSeriesSlide([selectedSlide], seriesInstanceUID) === selectedSlide
  ) {
    return { kind: 'unchanged', correctedSeriesUID: correction(selectedSlide) }
  }

  const imageSlide = findSeriesSlide(slides, seriesInstanceUID)
  if (imageSlide !== undefined) {
    return {
      kind: 'image',
      slide: imageSlide,
      correctedSeriesUID: correction(imageSlide),
    }
  }

  return { kind: 'lookupDerived' }
}

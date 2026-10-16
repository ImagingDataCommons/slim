import type { Slide } from '../../../data/slides'
import {
  findSlideBySeriesInstanceUID,
  seriesUidFromSlide,
} from '../../../utils/recoverSeriesInstanceUID'
import { parseSeriesInstanceUID } from '../../../utils/routes'

/** Slide whose series list includes `seriesInstanceUID` (or a mangled form). */
export function findSeriesSlide(
  slides: readonly Slide[],
  seriesInstanceUID: string,
): Slide | undefined {
  return findSlideBySeriesInstanceUID(slides, seriesInstanceUID)
}

/**
 * Presentation state from `?state=`, ignored when `access_token` is present
 * so OIDC callbacks cannot be mistaken for a PR UID.
 */
export function presentationStateUIDFromSearch(
  search: string,
): string | undefined {
  const searchParams = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  if (searchParams.has('access_token')) return undefined
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
  const slideForPath = findSeriesSlide(slides, seriesFromPath)
  return slideForPath !== undefined
    ? seriesUidFromSlide(slideForPath, seriesFromPath)
    : seriesFromPath
}

export type SyncRouteSlideMatch =
  | { kind: 'unchanged' }
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
  const currentSlideMatchesSeries =
    selectedSlide != null &&
    findSlideBySeriesInstanceUID([selectedSlide], seriesInstanceUID) ===
      selectedSlide

  if (selectedSlide != null && currentSlideMatchesSeries) {
    return { kind: 'unchanged' }
  }

  const imageSlide = findSeriesSlide(slides, seriesInstanceUID)
  if (imageSlide !== undefined) {
    const resolvedSeriesUID = seriesUidFromSlide(imageSlide, seriesInstanceUID)
    return {
      kind: 'image',
      slide: imageSlide,
      correctedSeriesUID:
        resolvedSeriesUID !== seriesInstanceUID ? resolvedSeriesUID : undefined,
    }
  }

  return { kind: 'lookupDerived' }
}

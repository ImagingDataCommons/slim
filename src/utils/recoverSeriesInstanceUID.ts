/**
 * Resolve a route series UID that may have been mangled by nested antd Menus
 * (they append ".0" to keys). Prefer exact match, then strip trailing ".0"
 * segments, then the longest strict prefix among known UIDs.
 */
export function recoverSeriesInstanceUID(
  seriesInstanceUID: string,
  candidateUIDs: readonly string[],
): string | undefined {
  if (seriesInstanceUID === '' || candidateUIDs.length === 0) {
    return undefined
  }

  if (candidateUIDs.includes(seriesInstanceUID)) {
    return seriesInstanceUID
  }

  let stripped = seriesInstanceUID
  while (/\.0$/.test(stripped)) {
    stripped = stripped.slice(0, -2)
    if (candidateUIDs.includes(stripped)) {
      return stripped
    }
  }

  let longestPrefix: string | undefined
  for (const uid of candidateUIDs) {
    if (
      seriesInstanceUID.startsWith(`${uid}.`) &&
      seriesInstanceUID.length > uid.length &&
      (longestPrefix === undefined || uid.length > longestPrefix.length)
    ) {
      longestPrefix = uid
    }
  }
  return longestPrefix
}

export function findSlideBySeriesInstanceUID<
  T extends { seriesInstanceUIDs: string[] },
>(slides: readonly T[], seriesInstanceUID: string): T | undefined {
  const exact = slides.find((slide) =>
    slide.seriesInstanceUIDs.includes(seriesInstanceUID),
  )
  if (exact !== undefined) {
    return exact
  }

  const allUIDs = slides.flatMap((slide) => slide.seriesInstanceUIDs)
  const recovered = recoverSeriesInstanceUID(seriesInstanceUID, allUIDs)
  if (recovered === undefined) {
    return undefined
  }
  return slides.find((slide) => slide.seriesInstanceUIDs.includes(recovered))
}

/**
 * Pick the series UID to use for a slide, recovering mangled route params.
 */
export function seriesUidFromSlide(
  slide: { seriesInstanceUIDs: string[] },
  preferredSeriesInstanceUID?: string,
): string {
  if (
    preferredSeriesInstanceUID !== undefined &&
    preferredSeriesInstanceUID !== ''
  ) {
    const recovered = recoverSeriesInstanceUID(
      preferredSeriesInstanceUID,
      slide.seriesInstanceUIDs,
    )
    if (recovered !== undefined) {
      return recovered
    }
  }
  return slide.seriesInstanceUIDs[0]
}

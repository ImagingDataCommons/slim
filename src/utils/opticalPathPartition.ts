export interface OpticalPathSequenceItemLike {
  OpticalPathIdentifier: string
  OpticalPathDescription?: string
}

export interface OpticalPathImageLike {
  SeriesInstanceUID: string
  OpticalPathSequence?: OpticalPathSequenceItemLike[]
}

export interface ActiveOpticalPath<P, I> {
  /** Stable React key: series plus optical path identifier */
  key: string
  opticalPath: P
  images: I[]
}

export interface AvailableOpticalPath {
  id: string
  title: string
}

export interface OpticalPathPartition<P, I> {
  active: Array<ActiveOpticalPath<P, I>>
  available: AvailableOpticalPath[]
}

/**
 * Value-based identity of the user-adjustable parts of an optical path style,
 * used to detect style changes made by the viewer (presentation states,
 * pixel statistics) behind freshly built style objects.
 */
export function getOpticalPathStyleSignature(style: {
  opacity: number
  color?: readonly number[]
  limitValues?: readonly number[]
}): string {
  return JSON.stringify([
    style.opacity,
    style.color ?? null,
    style.limitValues ?? null,
  ])
}

/** "id - description", or just "id" without a description */
export function formatOpticalPathOptionTitle(
  id: string,
  description: string | undefined,
): string {
  return description !== undefined && description !== ''
    ? `${id} - ${description}`
    : id
}

/**
 * Splits optical paths into the active ones (rendered as items) and the
 * inactive ones offered in the "Add optical path" selector. Paths without
 * image metadata, or whose identifier is missing from the first image's
 * Optical Path Sequence, are skipped.
 */
export function partitionOpticalPaths<
  P extends { identifier: string },
  I extends OpticalPathImageLike,
>(
  opticalPaths: readonly P[],
  metadata: Readonly<Record<string, I[] | undefined>>,
  activeIdentifiers: ReadonlySet<string>,
): OpticalPathPartition<P, I> {
  const active: Array<ActiveOpticalPath<P, I>> = []
  const available: AvailableOpticalPath[] = []
  for (const opticalPath of opticalPaths) {
    const id = opticalPath.identifier
    const images = metadata[id]
    const firstImage = images?.[0]
    if (images === undefined || firstImage === undefined) continue
    const item = firstImage.OpticalPathSequence?.find(
      (candidate) => candidate.OpticalPathIdentifier === id,
    )
    if (item === undefined) continue
    if (activeIdentifiers.has(id)) {
      active.push({
        key: `${firstImage.SeriesInstanceUID}-${id}`,
        opticalPath,
        images,
      })
    } else {
      available.push({
        id,
        title: formatOpticalPathOptionTitle(id, item.OpticalPathDescription),
      })
    }
  }
  return { active, available }
}

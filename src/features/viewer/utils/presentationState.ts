/** Pure decisions for applying Advanced Blending Presentation States. */

interface ReferencedInstance {
  ReferencedSOPInstanceUID: string
}

export interface BlendingItem {
  SeriesInstanceUID: string
  ReferencedInstanceSequence?: readonly ReferencedInstance[]
  ReferencedImageSequence?: readonly ReferencedInstance[]
  SoftcopyVOILUTSequence?: ReadonlyArray<{
    WindowCenter: number
    WindowWidth: number
  }>
}

export interface PresentationStateLike<B extends BlendingItem> {
  SOPInstanceUID: string
  AdvancedBlendingSequence: readonly B[]
}

export interface OpticalPathLike {
  identifier: string
  sopInstanceUIDs: readonly string[]
}

/**
 * Whether any blending input belongs to one of the slide's series. Other
 * presentation state classes have no blending inputs and never match.
 */
export function referencesSlideSeries(
  presentationState: Partial<PresentationStateLike<BlendingItem>>,
  slideSeriesInstanceUIDs: readonly string[],
): boolean {
  return (
    presentationState.AdvancedBlendingSequence?.some((item) =>
      slideSeriesInstanceUIDs.includes(item.SeriesInstanceUID),
    ) ?? false
  )
}

/**
 * Reports the first matching slot in order once every earlier slot has
 * settled. Slots settle out of order (parallel retrievals); `settle(index)`
 * without an item marks a slot that does not match (another slide, a
 * failed retrieval). `onFirst` runs at most once.
 */
export function createInOrderFirstMatch<T>(
  count: number,
  onFirst: (item: T) => void,
): (index: number, item?: T) => void {
  const outcomes: Array<{ item: T | undefined } | undefined> = new Array(count)
  let isDone = false
  return (index, item) => {
    if (isDone || index < 0 || index >= count) return
    outcomes[index] = { item }
    for (let i = 0; i < count; i++) {
      const outcome = outcomes[i]
      if (outcome === undefined) return
      if (outcome.item !== undefined) {
        isDone = true
        onFirst(outcome.item)
        return
      }
    }
    isDone = true
  }
}

/**
 * Referenced Instance Sequence should be used instead of Referenced Image
 * Sequence, but implementations mix them up, so either is accepted.
 */
function referencedInstances(
  item: BlendingItem,
): readonly ReferencedInstance[] {
  return item.ReferencedInstanceSequence ?? item.ReferencedImageSequence ?? []
}

/**
 * Blending input for each optical path whose images it references. When
 * several inputs reference the same path, the last one wins.
 */
export function matchBlendingItems<B extends BlendingItem>(
  opticalPaths: readonly OpticalPathLike[],
  blendingItems: readonly B[],
): Map<string, B> {
  const matches = new Map<string, B>()
  for (const opticalPath of opticalPaths) {
    for (const item of blendingItems) {
      const isReferenced = referencedInstances(item).some((instance) =>
        opticalPath.sopInstanceUIDs.includes(instance.ReferencedSOPInstanceUID),
      )
      if (isReferenced) matches.set(opticalPath.identifier, item)
    }
  }
  return matches
}

/** Append `instance`, replacing a listed instance with the same UID in place */
export function upsertBySopInstanceUID<T extends { SOPInstanceUID: string }>(
  list: readonly T[],
  instance: T,
): T[] {
  const byUID = new Map<string, T>()
  for (const item of list) byUID.set(item.SOPInstanceUID, item)
  byUID.set(instance.SOPInstanceUID, instance)
  return [...byUID.values()]
}

/**
 * Items sorted by their position in the study's search results, so the
 * picker lists states in the same order however retrievals finish. Items
 * without a known position keep their place at the end.
 */
export function sortByStudyOrder<T extends { SOPInstanceUID: string }>(
  list: readonly T[],
  studyIndexByUID: ReadonlyMap<string, number>,
): T[] {
  const position = (item: T): number =>
    studyIndexByUID.get(item.SOPInstanceUID) ?? Number.POSITIVE_INFINITY
  return [...list].sort((a, b) => position(a) - position(b))
}

/** VOI window as `[lower, upper]` limit values, if the item defines one. */
export function windowLimitValues(
  item: BlendingItem,
): [number, number] | undefined {
  const voi = item.SoftcopyVOILUTSequence?.[0]
  if (voi === undefined) return undefined
  return [
    voi.WindowCenter - voi.WindowWidth * 0.5,
    voi.WindowCenter + voi.WindowWidth * 0.5,
  ]
}

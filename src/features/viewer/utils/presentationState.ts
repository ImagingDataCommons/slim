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

/** Whether any blending input belongs to one of the slide's series. */
export function referencesSlideSeries(
  presentationState: PresentationStateLike<BlendingItem>,
  slideSeriesInstanceUIDs: readonly string[],
): boolean {
  return presentationState.AdvancedBlendingSequence.some((item) =>
    slideSeriesInstanceUIDs.includes(item.SeriesInstanceUID),
  )
}

/**
 * Whether a loaded presentation state should be applied: the one named in
 * the URL, or the first one found when the URL names none.
 */
export function shouldApplyPresentationState({
  index,
  sopInstanceUID,
  requestedUID,
}: {
  index: number
  sopInstanceUID: string
  requestedUID: string | null | undefined
}): boolean {
  if (requestedUID === null || requestedUID === undefined) return index === 0
  return sopInstanceUID === requestedUID
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

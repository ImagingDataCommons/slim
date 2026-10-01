/** Resolve the image slide a derived series (SR, ANN, SEG, PM, ...) refers to. */

export interface ReferencingInstance {
  SeriesInstanceUID: string
  SOPInstanceUID: string
  FrameOfReferenceUID?: string
  ContainerIdentifier?: string
  ReferencedSeriesSequence?: Array<{
    SeriesInstanceUID: string
  }>
  ContentSequence?: Array<{
    ConceptNameCodeSequence: Array<{
      CodeValue: string
    }>
    ContentSequence?: Array<{
      ContentSequence?: Array<{
        ReferencedSOPSequence?: Array<{
          ReferencedSOPInstanceUID: string
        }>
      }>
    }>
  }>
}

export interface ResolvableSlide {
  seriesInstanceUIDs: readonly string[]
  volumeImages: ReadonlyArray<{ SOPInstanceUID: string }>
}

const IMAGE_LIBRARY_CONCEPT_NAME_CODE = '111028'

/** Whether a naturalized dataset carries the identifiers of an instance. */
export function isReferencingInstance(
  dataset: object,
): dataset is ReferencingInstance {
  return (
    'SeriesInstanceUID' in dataset &&
    typeof dataset.SeriesInstanceUID === 'string' &&
    'SOPInstanceUID' in dataset &&
    typeof dataset.SOPInstanceUID === 'string'
  )
}

/** SOP Instance UID of the first image in an SR's Image Library, if any. */
function imageLibraryReferencedSOPInstanceUID(
  instance: ReferencingInstance,
): string | undefined {
  const imageLibrary = instance.ContentSequence?.find(
    (item) =>
      item.ConceptNameCodeSequence[0]?.CodeValue ===
      IMAGE_LIBRARY_CONCEPT_NAME_CODE,
  )
  return imageLibrary?.ContentSequence?.[0]?.ContentSequence?.[0]
    ?.ReferencedSOPSequence?.[0]?.ReferencedSOPInstanceUID
}

/**
 * The slide referenced by a derived instance: first through its Referenced
 * Series Sequence, then through the image library of an SR document.
 */
export function resolveReferencedSlide<S extends ResolvableSlide>(
  slides: readonly S[],
  instance: ReferencingInstance,
): S | undefined {
  for (const referencedSeries of instance.ReferencedSeriesSequence ?? []) {
    const slide = slides.find((candidate) =>
      candidate.seriesInstanceUIDs.includes(referencedSeries.SeriesInstanceUID),
    )
    if (slide !== undefined) return slide
  }
  const sopInstanceUID = imageLibraryReferencedSOPInstanceUID(instance)
  if (sopInstanceUID === undefined) return undefined
  return slides.find((slide) =>
    slide.volumeImages.some((image) => image.SOPInstanceUID === sopInstanceUID),
  )
}

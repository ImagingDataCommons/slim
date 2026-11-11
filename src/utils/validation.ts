/** Pure slide/annotation validators used by the ValidationContext. */

export interface ValidationResult {
  isValid: boolean
  message?: string
  type: 'warning' | 'error' | 'info'
}

export interface ValidatableSlide {
  volumeImages?: ReadonlyArray<{ SOPInstanceUID?: string | null }>
}

export interface ValidatableAnnotationGroup {
  referencedSOPInstanceUID?: string
}

export const VALID_RESULT: ValidationResult = { isValid: true, type: 'info' }

export const MISSING_PYRAMID_MESSAGE =
  'This slide is missing a multi-resolution pyramid. Display and performance may be degraded.'

export const UNASSOCIATED_ANNOTATION_GROUP_MESSAGE =
  'The annotation group is not associated with any slide.'

/** A slide needs more than one volume image to form a resolution pyramid. */
export function validatePyramid(slide: ValidatableSlide): ValidationResult {
  if ((slide.volumeImages?.length ?? 0) <= 1) {
    return {
      isValid: false,
      message: MISSING_PYRAMID_MESSAGE,
      type: 'warning',
    }
  }
  return VALID_RESULT
}

/**
 * The annotation group must reference a volume image of one of the slides.
 * Nothing is checked while there is no group or no slides have loaded.
 */
export function validateAnnotationGroupAssociation(
  annotationGroup: ValidatableAnnotationGroup | undefined | null,
  slides: readonly ValidatableSlide[] | undefined | null,
): ValidationResult {
  if (
    annotationGroup === undefined ||
    annotationGroup === null ||
    slides === undefined ||
    slides === null ||
    slides.length === 0
  ) {
    return VALID_RESULT
  }
  const referencedUID = annotationGroup.referencedSOPInstanceUID
  const hasMatchingSlide = slides.some(
    (slide) =>
      slide.volumeImages?.some(
        (image) =>
          image.SOPInstanceUID !== null &&
          image.SOPInstanceUID !== undefined &&
          image.SOPInstanceUID === referencedUID,
      ) ?? false,
  )
  if (!hasMatchingSlide) {
    return {
      isValid: false,
      message: UNASSOCIATED_ANNOTATION_GROUP_MESSAGE,
      type: 'warning',
    }
  }
  return VALID_RESULT
}

/** First failing validation for the given context, else {@link VALID_RESULT}. */
export function runValidationChecks({
  slide,
  annotationGroup,
  slides,
}: {
  slide?: ValidatableSlide | null
  annotationGroup?: ValidatableAnnotationGroup | null
  slides?: readonly ValidatableSlide[] | null
}): ValidationResult {
  if (slide !== undefined && slide !== null) {
    const pyramid = validatePyramid(slide)
    if (!pyramid.isValid) return pyramid
  }
  return validateAnnotationGroupAssociation(annotationGroup, slides)
}

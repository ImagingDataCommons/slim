import {
  MISSING_PYRAMID_MESSAGE,
  runValidationChecks,
  UNASSOCIATED_ANNOTATION_GROUP_MESSAGE,
  VALID_RESULT,
  validateAnnotationGroupAssociation,
  validatePyramid,
} from '../validation'

const pyramidSlide = {
  volumeImages: [{ SOPInstanceUID: '1.1' }, { SOPInstanceUID: '1.2' }],
}
const flatSlide = { volumeImages: [{ SOPInstanceUID: '2.1' }] }

describe('validatePyramid', () => {
  it('accepts slides with several volume images', () => {
    expect(validatePyramid(pyramidSlide)).toEqual(VALID_RESULT)
  })

  it('warns about slides with zero or one volume image', () => {
    const warning = {
      isValid: false,
      message: MISSING_PYRAMID_MESSAGE,
      type: 'warning',
    }
    expect(validatePyramid(flatSlide)).toEqual(warning)
    expect(validatePyramid({ volumeImages: [] })).toEqual(warning)
    expect(validatePyramid({})).toEqual(warning)
  })
})

describe('validateAnnotationGroupAssociation', () => {
  it('skips the check without a group or slides', () => {
    expect(
      validateAnnotationGroupAssociation(undefined, [pyramidSlide]),
    ).toEqual(VALID_RESULT)
    expect(
      validateAnnotationGroupAssociation({ referencedSOPInstanceUID: 'x' }, []),
    ).toEqual(VALID_RESULT)
    expect(
      validateAnnotationGroupAssociation(
        { referencedSOPInstanceUID: 'x' },
        null,
      ),
    ).toEqual(VALID_RESULT)
  })

  it('accepts a group referencing a volume image of any slide', () => {
    expect(
      validateAnnotationGroupAssociation({ referencedSOPInstanceUID: '2.1' }, [
        pyramidSlide,
        flatSlide,
      ]),
    ).toEqual(VALID_RESULT)
  })

  it('warns when no slide matches', () => {
    const warning = {
      isValid: false,
      message: UNASSOCIATED_ANNOTATION_GROUP_MESSAGE,
      type: 'warning',
    }
    expect(
      validateAnnotationGroupAssociation({ referencedSOPInstanceUID: '9.9' }, [
        pyramidSlide,
      ]),
    ).toEqual(warning)
    expect(
      validateAnnotationGroupAssociation({}, [
        { volumeImages: [{ SOPInstanceUID: undefined }] },
      ]),
    ).toEqual(warning)
    expect(
      validateAnnotationGroupAssociation({ referencedSOPInstanceUID: '1' }, [
        {},
      ]),
    ).toEqual(warning)
  })
})

describe('runValidationChecks', () => {
  it('passes with an empty context', () => {
    expect(runValidationChecks({})).toEqual(VALID_RESULT)
  })

  it('reports the pyramid check before the association check', () => {
    expect(
      runValidationChecks({
        slide: flatSlide,
        annotationGroup: { referencedSOPInstanceUID: '9.9' },
        slides: [pyramidSlide],
      }).message,
    ).toBe(MISSING_PYRAMID_MESSAGE)
  })

  it('reports the association check when the slide is valid', () => {
    expect(
      runValidationChecks({
        slide: pyramidSlide,
        annotationGroup: { referencedSOPInstanceUID: '9.9' },
        slides: [pyramidSlide],
      }).message,
    ).toBe(UNASSOCIATED_ANNOTATION_GROUP_MESSAGE)
  })
})

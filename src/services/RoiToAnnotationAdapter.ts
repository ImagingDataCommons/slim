import type * as dmv from 'dicom-microscopy-viewer'
import type { AnnotationCategoryAndType } from '../components/AnnotationCategoryList'
import {
  FINDING_CATEGORY_CODE,
  FINDING_TYPE_CODE,
} from '../utils/roiDescription'

const UNDEFINED_CODE = {
  CodeValue: 'undefined',
  CodeMeaning: 'undefined',
  CodingSchemeDesignator: 'undefined',
}

/**
 * Category and type of an ROI from its coded evaluations (named as in the
 * Segment and Annotation Group panels), for the annotation category list.
 */
export const adaptRoiToAnnotation = (
  roi: dmv.roi.ROI,
): AnnotationCategoryAndType => {
  let category = UNDEFINED_CODE
  let type = UNDEFINED_CODE
  roi.evaluations.forEach((item) => {
    if (item.ValueType !== 'CODE' || !('ConceptCodeSequence' in item)) return
    const value = item.ConceptCodeSequence[0]
    const nameValue = item.ConceptNameCodeSequence[0].CodeValue
    if (nameValue === FINDING_CATEGORY_CODE) {
      category = { ...value }
    } else if (nameValue === FINDING_TYPE_CODE) {
      type = { ...value }
    }
  })
  return { category, type, uid: roi.uid }
}

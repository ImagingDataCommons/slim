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

function isUndefinedCode(code: {
  CodeValue: string
  CodingSchemeDesignator: string
}): boolean {
  return (
    code.CodeValue === UNDEFINED_CODE.CodeValue &&
    code.CodingSchemeDesignator === UNDEFINED_CODE.CodingSchemeDesignator
  )
}

/**
 * Category and type of an ROI from its coded evaluations (named as in the
 * Segment and Annotation Group panels), for the annotation category list.
 * When Finding category is missing but Finding type is present (common for
 * hand-drawn ROIs before category was attached), group under the type so the
 * panel does not show a literal "undefined" category chip.
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
  if (isUndefinedCode(category) && !isUndefinedCode(type)) {
    category = { ...type }
  }
  return { category, type, uid: roi.uid }
}

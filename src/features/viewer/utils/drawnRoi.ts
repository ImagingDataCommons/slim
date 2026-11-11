/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import type { AnnotationDraft } from './annotationDraft'

const FINDING_NAME = {
  value: '121071',
  meaning: 'Finding',
  schemeDesignator: 'DCM',
}

const FINDING_CATEGORY_NAME = {
  value: '276214006',
  meaning: 'Finding category',
  schemeDesignator: 'SCT',
}

type CodedConcept = dcmjs.sr.coding.CodedConcept

/**
 * Attach the draft's finding, optional finding category, and evaluations to a
 * drawn ROI. Returns false when the ROI or finding is missing so the caller
 * can skip adding it.
 */
export function attachDraftEvaluations(
  roi: dmv.roi.ROI | undefined,
  draft: AnnotationDraft,
  findingCategory?: CodedConcept,
): boolean {
  if (roi === undefined || draft.finding === undefined) return false
  if (findingCategory !== undefined) {
    roi.addEvaluation(
      new dcmjs.sr.valueTypes.CodeContentItem({
        name: new dcmjs.sr.coding.CodedConcept(FINDING_CATEGORY_NAME),
        value: findingCategory,
        relationshipType: 'CONTAINS',
      }),
    )
  }
  roi.addEvaluation(
    new dcmjs.sr.valueTypes.CodeContentItem({
      name: new dcmjs.sr.coding.CodedConcept(FINDING_NAME),
      value: draft.finding,
      relationshipType: 'CONTAINS',
    }),
  )
  for (const evaluation of draft.evaluations) {
    roi.addEvaluation(
      new dcmjs.sr.valueTypes.CodeContentItem({
        name: evaluation.name,
        value: evaluation.value,
        relationshipType: 'CONTAINS',
      }),
    )
  }
  return true
}

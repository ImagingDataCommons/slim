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

/**
 * Attach the draft's finding and evaluations to a drawn ROI. Returns false
 * when the ROI or finding is missing so the caller can skip adding it.
 */
export function attachDraftEvaluations(
  roi: dmv.roi.ROI | undefined,
  draft: AnnotationDraft,
): boolean {
  if (roi === undefined || draft.finding === undefined) return false
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

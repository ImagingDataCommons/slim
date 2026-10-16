/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'

import type { Evaluation } from '../../../components/SlideViewer/types'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'

type CodedConcept = dcmjs.sr.coding.CodedConcept

/** Choices made in the annotation dialog before drawing an ROI */
export interface AnnotationDraft {
  finding?: CodedConcept
  evaluations: Evaluation[]
  geometryType?: string
  markup?: 'measurement'
}

export const EMPTY_ANNOTATION_DRAFT: AnnotationDraft = { evaluations: [] }

export type AnnotationDraftAction =
  | {
      type: 'selectFinding'
      finding: CodedConcept
      allowedGeometryTypes: readonly string[] | undefined
    }
  | { type: 'selectGeometryType'; geometryType: string }
  | { type: 'setMeasurement'; isActive: boolean }
  | { type: 'selectEvaluation'; name: CodedConcept; value: CodedConcept }
  | { type: 'clearEvaluation'; name?: CodedConcept }

function withoutEvaluation(
  evaluations: readonly Evaluation[],
  name: CodedConcept,
): Evaluation[] {
  const key = codedConceptKey(name)
  return evaluations.filter((item) => codedConceptKey(item.name) !== key)
}

/**
 * Selecting a finding resets the evaluations and drops a geometry type the
 * finding does not allow; an evaluation replaces any earlier value for the
 * same name; clearing without a name clears every evaluation.
 */
export function annotationDraftReducer(
  draft: AnnotationDraft,
  action: AnnotationDraftAction,
): AnnotationDraft {
  switch (action.type) {
    case 'selectFinding':
      return {
        ...draft,
        finding: action.finding,
        evaluations: [],
        geometryType:
          draft.geometryType !== undefined &&
          action.allowedGeometryTypes?.includes(draft.geometryType) === true
            ? draft.geometryType
            : undefined,
      }
    case 'selectGeometryType':
      return { ...draft, geometryType: action.geometryType }
    case 'setMeasurement':
      return { ...draft, markup: action.isActive ? 'measurement' : undefined }
    case 'selectEvaluation':
      return {
        ...draft,
        evaluations: [
          ...withoutEvaluation(draft.evaluations, action.name),
          { name: action.name, value: action.value },
        ],
      }
    case 'clearEvaluation':
      return {
        ...draft,
        evaluations:
          action.name === undefined
            ? []
            : withoutEvaluation(draft.evaluations, action.name),
      }
  }
}

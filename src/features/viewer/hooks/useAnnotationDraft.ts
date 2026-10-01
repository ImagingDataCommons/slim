/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'
import { useReducer } from 'react'

import type { EvaluationOptions } from '../../../components/SlideViewer/types'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'
import { logger } from '../../../utils/logger'
import type { AnnotationConfig } from '../utils/annotationConfig'
import {
  type AnnotationDraft,
  annotationDraftReducer,
  EMPTY_ANNOTATION_DRAFT,
} from '../utils/annotationDraft'

type CodedConcept = dcmjs.sr.coding.CodedConcept

export interface AnnotationDraftApi {
  draft: AnnotationDraft
  /** Evaluations offered for the selected finding */
  evaluationOptions: readonly EvaluationOptions[]
  /** Geometry types allowed for the selected finding */
  geometryTypes: readonly string[]
  onFindingChange: (finding: CodedConcept) => void
  onGeometryTypeChange: (geometryType: string) => void
  onMeasurementChange: (isActive: boolean) => void
  onEvaluationChange: (name: CodedConcept, value: CodedConcept) => void
  onEvaluationClear: (name?: CodedConcept) => void
}

/** Choices of the annotation dialog, kept between drawings */
export function useAnnotationDraft(
  config: AnnotationConfig,
): AnnotationDraftApi {
  const [draft, dispatch] = useReducer(
    annotationDraftReducer,
    EMPTY_ANNOTATION_DRAFT,
  )
  const key =
    draft.finding !== undefined ? codedConceptKey(draft.finding) : undefined

  return {
    draft,
    evaluationOptions:
      key !== undefined ? (config.evaluationOptions[key] ?? []) : [],
    geometryTypes: key !== undefined ? (config.geometryTypes[key] ?? []) : [],
    onFindingChange: (finding) => {
      logger.log(`selected finding "${finding.CodeMeaning}"`)
      dispatch({
        type: 'selectFinding',
        finding,
        allowedGeometryTypes: config.geometryTypes[codedConceptKey(finding)],
      })
    },
    onGeometryTypeChange: (geometryType) => {
      dispatch({ type: 'selectGeometryType', geometryType })
    },
    onMeasurementChange: (isActive) => {
      dispatch({ type: 'setMeasurement', isActive })
    },
    onEvaluationChange: (name, value) => {
      dispatch({ type: 'selectEvaluation', name, value })
    },
    onEvaluationClear: (name) => {
      dispatch({ type: 'clearEvaluation', name })
    },
  }
}

/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import type { EvaluationOptions } from '../../../components/SlideViewer/types'
import { formatRoiStyle } from '../../../components/SlideViewer/utils/roiUtils'
import type { AnnotationSettings } from '../../../types/annotations'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'

type CodedConcept = dcmjs.sr.coding.CodedConcept

/** Geometry types offered when a finding does not restrict them */
export const DEFAULT_GEOMETRY_TYPES: readonly string[] = [
  'point',
  'circle',
  'box',
  'polygon',
  'line',
  'freehandpolygon',
  'freehandline',
]

/** Drawing options derived from the configured annotations, keyed by finding */
export interface AnnotationConfig {
  findings: CodedConcept[]
  evaluationOptions: Readonly<Record<string, EvaluationOptions[]>>
  geometryTypes: Readonly<Record<string, readonly string[]>>
  configuredStyles: Readonly<Record<string, dmv.viewer.ROIStyleOptions>>
}

/** Findings, evaluations, geometry types and styles of `annotations`. */
export function buildAnnotationConfig(
  annotations: readonly AnnotationSettings[],
): AnnotationConfig {
  const findings: CodedConcept[] = []
  const evaluationOptions: Record<string, EvaluationOptions[]> = {}
  const geometryTypes: Record<string, readonly string[]> = {}
  const configuredStyles: Record<string, dmv.viewer.ROIStyleOptions> = {}
  for (const annotation of annotations) {
    const finding = new dcmjs.sr.coding.CodedConcept(annotation.finding)
    findings.push(finding)
    const key = codedConceptKey(finding)
    geometryTypes[key] = annotation.geometryTypes ?? DEFAULT_GEOMETRY_TYPES
    evaluationOptions[key] = (annotation.evaluations ?? []).map(
      (evaluation) => ({
        name: new dcmjs.sr.coding.CodedConcept(evaluation.name),
        values: evaluation.values.map(
          (value) => new dcmjs.sr.coding.CodedConcept(value),
        ),
      }),
    )
    if (annotation.style !== null && annotation.style !== undefined) {
      configuredStyles[key] = formatRoiStyle(annotation.style)
    }
  }
  return { findings, evaluationOptions, geometryTypes, configuredStyles }
}

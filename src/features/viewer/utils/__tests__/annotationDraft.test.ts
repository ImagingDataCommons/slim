import * as dcmjs from 'dcmjs'

import {
  type AnnotationDraft,
  annotationDraftReducer,
  EMPTY_ANNOTATION_DRAFT,
} from '../annotationDraft'

const concept = (
  value: string,
  meaning: string,
): dcmjs.sr.coding.CodedConcept =>
  new dcmjs.sr.coding.CodedConcept({ value, meaning, schemeDesignator: 'SCT' })

const tumor = concept('108369006', 'Tumor')
const grade = concept('1', 'Grade')
const low = concept('2', 'Low')
const high = concept('3', 'High')

describe('annotationDraftReducer', () => {
  it('resets evaluations and keeps an allowed geometry type on a new finding', () => {
    const draft: AnnotationDraft = {
      evaluations: [{ name: grade, value: low }],
      geometryType: 'polygon',
    }

    const kept = annotationDraftReducer(draft, {
      type: 'selectFinding',
      finding: tumor,
      allowedGeometryTypes: ['polygon', 'point'],
    })
    expect(kept).toEqual({
      finding: tumor,
      evaluations: [],
      geometryType: 'polygon',
    })

    const dropped = annotationDraftReducer(draft, {
      type: 'selectFinding',
      finding: tumor,
      allowedGeometryTypes: ['point'],
    })
    expect(dropped.geometryType).toBeUndefined()
  })

  it('replaces the value of an evaluation with the same name', () => {
    const first = annotationDraftReducer(EMPTY_ANNOTATION_DRAFT, {
      type: 'selectEvaluation',
      name: grade,
      value: low,
    })
    const second = annotationDraftReducer(first, {
      type: 'selectEvaluation',
      name: concept('1', 'Grade (renamed)'),
      value: high,
    })

    expect(second.evaluations).toHaveLength(1)
    expect(second.evaluations[0].value).toBe(high)
  })

  it('clears one evaluation by name or all of them', () => {
    const draft: AnnotationDraft = {
      evaluations: [
        { name: grade, value: low },
        { name: concept('9', 'Margin'), value: high },
      ],
    }

    expect(
      annotationDraftReducer(draft, { type: 'clearEvaluation', name: grade })
        .evaluations,
    ).toHaveLength(1)
    expect(
      annotationDraftReducer(draft, { type: 'clearEvaluation' }).evaluations,
    ).toEqual([])
  })

  it('toggles the measurement markup and sets the geometry type', () => {
    const measuring = annotationDraftReducer(EMPTY_ANNOTATION_DRAFT, {
      type: 'setMeasurement',
      isActive: true,
    })
    expect(measuring.markup).toBe('measurement')
    expect(
      annotationDraftReducer(measuring, {
        type: 'setMeasurement',
        isActive: false,
      }).markup,
    ).toBeUndefined()
    expect(
      annotationDraftReducer(EMPTY_ANNOTATION_DRAFT, {
        type: 'selectGeometryType',
        geometryType: 'line',
      }).geometryType,
    ).toBe('line')
  })
})

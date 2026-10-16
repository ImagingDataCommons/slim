/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'

import type { AnnotationDraft } from '../annotationDraft'
import { attachDraftEvaluations } from '../drawnRoi'

describe('attachDraftEvaluations', () => {
  it('returns false when the ROI or finding is missing', () => {
    const draft: AnnotationDraft = {
      finding: undefined,
      evaluations: [],
      geometryType: 'polygon',
      markup: undefined,
    }
    expect(attachDraftEvaluations(undefined, draft)).toBe(false)

    const roi = { addEvaluation: vi.fn() }
    expect(attachDraftEvaluations(roi as never, draft)).toBe(false)
    expect(roi.addEvaluation).not.toHaveBeenCalled()
  })

  it('attaches finding and evaluation content items', () => {
    const evaluations: unknown[] = []
    const roi = {
      addEvaluation: vi.fn((item: unknown) => {
        evaluations.push(item)
      }),
    }
    const finding = new dcmjs.sr.coding.CodedConcept({
      value: 'f',
      schemeDesignator: 'SCT',
      meaning: 'Finding',
    })
    const draft: AnnotationDraft = {
      finding,
      evaluations: [
        {
          name: new dcmjs.sr.coding.CodedConcept({
            value: 'n',
            schemeDesignator: 'SCT',
            meaning: 'Name',
          }),
          value: new dcmjs.sr.coding.CodedConcept({
            value: 'v',
            schemeDesignator: 'SCT',
            meaning: 'Value',
          }),
        },
      ],
      geometryType: 'polygon',
      markup: undefined,
    }

    expect(attachDraftEvaluations(roi as never, draft)).toBe(true)
    expect(roi.addEvaluation).toHaveBeenCalledTimes(2)
    expect(evaluations).toHaveLength(2)
  })
})

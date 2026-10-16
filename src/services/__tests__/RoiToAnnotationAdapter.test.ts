import type * as dmv from 'dicom-microscopy-viewer'

import { adaptRoiToAnnotation } from '../RoiToAnnotationAdapter'

const code = (value: string, meaning: string) => ({
  CodeValue: value,
  CodeMeaning: meaning,
  CodingSchemeDesignator: 'SCT',
})

function roiWith(evaluations: unknown[]): dmv.roi.ROI {
  const roi: unknown = { uid: 'roi-1', evaluations }
  return roi as dmv.roi.ROI
}

describe('adaptRoiToAnnotation', () => {
  it('reads category and type from coded evaluations', () => {
    const annotation = adaptRoiToAnnotation(
      roiWith([
        {
          ValueType: 'CODE',
          ConceptNameCodeSequence: [code('276214006', 'Finding category')],
          ConceptCodeSequence: [code('49755003', 'Morphologic abnormality')],
        },
        {
          ValueType: 'CODE',
          ConceptNameCodeSequence: [code('121071', 'Finding')],
          ConceptCodeSequence: [code('108369006', 'Tumor')],
        },
      ]),
    )
    expect(annotation).toEqual({
      uid: 'roi-1',
      category: code('49755003', 'Morphologic abnormality'),
      type: code('108369006', 'Tumor'),
    })
  })

  it('falls back to undefined codes and ignores text evaluations', () => {
    const annotation = adaptRoiToAnnotation(
      roiWith([
        {
          ValueType: 'TEXT',
          ConceptNameCodeSequence: [code('121071', 'Finding')],
          TextValue: 'free text',
        },
      ]),
    )
    expect(annotation.category.CodeValue).toBe('undefined')
    expect(annotation.type.CodeValue).toBe('undefined')
  })
})

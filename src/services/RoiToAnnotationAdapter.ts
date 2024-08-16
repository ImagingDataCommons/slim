import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'
import { AnnotationCategoryAndType } from '../components/AnnotationCategoryList'

export const adaptRoiToAnnotation = (roi: dmv.roi.ROI): AnnotationCategoryAndType => {
  const { uid, evaluations } = roi

  const result = {
    category: {
      CodeValue: 'undefined',
      CodeMeaning: 'undefined',
      CodingSchemeDesignator: 'undefined'
    },
    type: {
      CodeValue: 'undefined',
      CodeMeaning: 'undefined',
      CodingSchemeDesignator: 'undefined'
    }
  }

  evaluations.forEach((
    item: (
      dcmjs.sr.valueTypes.TextContentItem |
      dcmjs.sr.valueTypes.CodeContentItem
    )
  ) => {
    const nameValue = item.ConceptNameCodeSequence[0].CodeValue
    if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
      const codeContentItem = item as dcmjs.sr.valueTypes.CodeContentItem
      const value = codeContentItem.ConceptCodeSequence[0]
      // For consistency with Segment and Annotation Group
      if (nameValue === '276214006') {
        result.category = { ...value }
      } else if (nameValue === '121071') {
        result.type = { ...value }
      }
    }
  })

  return {
    ...result,
    uid
  }
}

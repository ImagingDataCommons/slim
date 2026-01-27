// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
import { findContentItemsByName } from '../../../utils/sr'

/**
 * Builds a key for a concept based on its coding scheme and value
 */
export const buildKey = (concept: {
  CodeValue: string
  CodeMeaning: string
  CodingSchemeDesignator: string
  CodingSchemeVersion?: string
}): string => {
  const codingScheme = concept.CodingSchemeDesignator
  const codeValue = concept.CodeValue
  return `${codingScheme}-${codeValue}`
}

/**
 * Gets the ROI key from a ROI object
 */
export const getRoiKey = (roi: dmv.roi.ROI): string | undefined => {
  const matches = findContentItemsByName({
    content: roi.evaluations,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '121071',
      meaning: 'Finding',
      schemeDesignator: 'DCM',
    }),
  })
  if (matches.length === 0) {
    console.warn(`no finding found for ROI ${roi.uid}`)
    return
  }
  const finding = matches[0] as dcmjs.sr.valueTypes.CodeContentItem
  const findingName = finding.ConceptCodeSequence[0]
  return buildKey(findingName)
}

/**
 * Compares two ROIs for equality based on their spatial coordinates
 */
export const areROIsEqual = (a: dmv.roi.ROI, b: dmv.roi.ROI): boolean => {
  if (a.scoord3d.graphicType !== b.scoord3d.graphicType) {
    return false
  }
  if (a.scoord3d.frameOfReferenceUID !== b.scoord3d.frameOfReferenceUID) {
    return false
  }
  if (a.scoord3d.graphicData.length !== b.scoord3d.graphicData.length) {
    return false
  }

  const decimals = 6
  for (let i = 0; i < a.scoord3d.graphicData.length; ++i) {
    if (a.scoord3d.graphicType === 'POINT') {
      const s1 = a.scoord3d as dmv.scoord3d.Point
      const s2 = b.scoord3d as dmv.scoord3d.Point
      const c1 = s1.graphicData[i].toPrecision(decimals)
      const c2 = s2.graphicData[i].toPrecision(decimals)
      if (c1 !== c2) {
        return false
      }
    } else {
      const s1 = a.scoord3d as dmv.scoord3d.Polygon
      const s2 = b.scoord3d as dmv.scoord3d.Polygon
      for (let j = 0; j < s1.graphicData[i].length; ++j) {
        const c1 = s1.graphicData[i][j].toPrecision(decimals)
        const c2 = s2.graphicData[i][j].toPrecision(decimals)
        if (c1 !== c2) {
          return false
        }
      }
    }
  }
  return true
}

/**
 * Formats ROI style options
 */
export const formatRoiStyle = (style: {
  stroke?: {
    color?: number[]
    width?: number
  }
  fill?: {
    color?: number[]
  }
  radius?: number
}): dmv.viewer.ROIStyleOptions => {
  const stroke = {
    color: style.stroke?.color ?? [255, 234, 0],
    width: style.stroke?.width ?? 2,
  }
  const fill = {
    color: style.fill?.color ?? [255, 234, 0, 0.2],
  }
  return {
    stroke,
    fill,
    image: {
      circle: {
        radius: style.radius ?? Math.max(5 - stroke.width, 1),
        stroke,
        fill,
      },
    },
  }
}

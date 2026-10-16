/** skipcq: JS-C1003 - dcmjs uses nested namespaces (dcmjs.sr.coding.CodedConcept) */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 - dmv uses nested namespaces (dmv.roi, dmv.scoord3d) */
import type * as dmv from 'dicom-microscopy-viewer'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'
import { findContentItemsByName } from '../../../utils/sr'

/** {@link codedConceptKey} of the ROI's finding, if it has one */
export const getRoiKey = (
  roi: Pick<dmv.roi.ROI, 'uid' | 'evaluations'>,
): string | undefined => {
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
  return codedConceptKey(finding.ConceptCodeSequence[0])
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
 * CSS color for an ROI stroke color (`[r, g, b]` or `[r, g, b, a]`, alpha
 * ignored); `fallback` when the color is missing or malformed.
 */
export const roiStrokeToCssColor = (
  color: readonly number[] | undefined,
  fallback: string,
): string => {
  if (color === undefined || color.length < 3) return fallback
  const channels = color.slice(0, 3)
  if (!channels.every((channel) => Number.isFinite(channel))) return fallback
  const [r, g, b] = channels.map((channel) =>
    Math.round(Math.min(255, Math.max(0, channel))),
  )
  return `rgb(${r}, ${g}, ${b})`
}

/** "Annotation was removed" / "3 annotations were removed" */
export const formatRoiRemovalMessage = (count: number): string =>
  count === 1 ? 'Annotation was removed' : `${count} annotations were removed`

/** Alpha of the default ROI fill, derived from the stroke color. */
export const DEFAULT_ROI_FILL_ALPHA = 0.2

/**
 * Default style for ROIs without a configured finding style, built from the
 * user's stroke preferences (RGB color, width in px).
 */
export const buildDefaultRoiStyle = ({
  strokeColor,
  strokeWidth,
  radius,
}: {
  strokeColor: number[]
  strokeWidth: number
  radius: number
}): dmv.viewer.ROIStyleOptions => {
  const rgb = strokeColor.slice(0, 3)
  return {
    stroke: { color: rgb, width: strokeWidth },
    fill: { color: [...rgb, DEFAULT_ROI_FILL_ALPHA] },
    image: {
      circle: {
        fill: { color: rgb },
        radius,
      },
    },
  }
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

import {
  ALGORITHM_NAME_CODE,
  FINDING_CATEGORY_CODE,
  FINDING_TYPE_CODE,
} from '../../../utils/roiDescription'

export interface HoveredRoiAttribute {
  name: string
  value: string
}

/** One row of the hover tooltip */
export interface HoveredRoi {
  /** 1-based ROI or annotation number */
  index: number
  roiUid: string
  attributes: HoveredRoiAttribute[]
  seriesDescription: string
}

/** An ROI under the pointer; bulk annotations carry their group UID */
export interface HoveredFeature<R extends { uid: string }> {
  roi: R
  annotationGroupUID: string | null
}

interface CodeLike {
  CodeValue: string
  CodeMeaning?: string
}

export interface HoveredAnnotationGroupItem {
  AnnotationGroupLabel?: string
  AnnotationPropertyCategoryCodeSequence?: readonly CodeLike[]
  AnnotationPropertyTypeCodeSequence?: readonly CodeLike[]
}

export interface HoveredEvaluation {
  ValueType: string
  ConceptNameCodeSequence: readonly CodeLike[]
  ConceptCodeSequence?: readonly CodeLike[]
  TextValue?: string
}

export const SERIES_DESCRIPTION_ATTRIBUTE = 'Series Description'
export const ANNOTATION_GROUP_LABEL_ATTRIBUTE = 'Annotation Group Label'
export const UNKNOWN_SERIES = 'Unknown Series'

/** Consistent with the Segment and Annotation Group panels */
const EVALUATION_LABELS: Readonly<Record<string, string>> = {
  [FINDING_CATEGORY_CODE]: 'Property category',
  [FINDING_TYPE_CODE]: 'Property type',
  [ALGORITHM_NAME_CODE]: 'Algorithm Name',
}

function meaningOrValue(code: CodeLike): string {
  return code.CodeMeaning !== undefined && code.CodeMeaning !== ''
    ? code.CodeMeaning
    : code.CodeValue
}

/**
 * Bulk annotation ROI UIDs are `<annotationGroupUID>-<annotationIndex>`;
 * returns the 0-based index, or 0 when the UID has no numeric suffix.
 */
export function annotationIndexFromRoiUid(roiUid: string): number {
  if (!roiUid.includes('-')) return 0
  const parsed = Number.parseInt(roiUid.slice(roiUid.lastIndexOf('-') + 1), 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Tooltip row for a bulk annotation of an annotation group. */
export function describeBulkAnnotation({
  roiUid,
  item,
  seriesDescription,
}: {
  roiUid: string
  item: HoveredAnnotationGroupItem
  seriesDescription: string
}): HoveredRoi {
  const attributes: HoveredRoiAttribute[] = []
  if (seriesDescription !== '') {
    attributes.push({
      name: SERIES_DESCRIPTION_ATTRIBUTE,
      value: seriesDescription,
    })
  }
  if (
    item.AnnotationGroupLabel !== undefined &&
    item.AnnotationGroupLabel !== ''
  ) {
    attributes.push({
      name: ANNOTATION_GROUP_LABEL_ATTRIBUTE,
      value: item.AnnotationGroupLabel,
    })
  }
  const category = item.AnnotationPropertyCategoryCodeSequence?.[0]
  if (category !== undefined) {
    attributes.push({
      name: 'Property category',
      value: meaningOrValue(category),
    })
  }
  const type = item.AnnotationPropertyTypeCodeSequence?.[0]
  if (type !== undefined) {
    attributes.push({ name: 'Property type', value: meaningOrValue(type) })
  }
  return {
    index: annotationIndexFromRoiUid(roiUid) + 1,
    roiUid,
    attributes,
    seriesDescription,
  }
}

/** Tooltip attributes for the evaluations of an SR ROI. */
export function describeEvaluations(
  evaluations: readonly HoveredEvaluation[],
): HoveredRoiAttribute[] {
  const attributes: HoveredRoiAttribute[] = []
  for (const item of evaluations) {
    const name = item.ConceptNameCodeSequence[0]
    if (item.ValueType === 'CODE') {
      attributes.push({
        name:
          EVALUATION_LABELS[name?.CodeValue ?? ''] ?? `${name?.CodeMeaning}`,
        value: `${item.ConceptCodeSequence?.[0]?.CodeMeaning}`,
      })
    } else if (item.ValueType === 'TEXT') {
      attributes.push({
        name: `${name?.CodeMeaning}`,
        value: item.TextValue ?? '',
      })
    }
  }
  return attributes
}

/** Order by ROI number, then by series description. */
export function compareHoveredRois(a: HoveredRoi, b: HoveredRoi): number {
  return (
    a.index - b.index || a.seriesDescription.localeCompare(b.seriesDescription)
  )
}

/**
 * First occurrence of each ROI under the pointer that is currently shown:
 * bulk annotations by group visibility, SR ROIs by ROI visibility.
 */
export function visibleHoveredFeatures<R extends { uid: string }>(
  features: ReadonlyArray<HoveredFeature<R>>,
  visibleRoiUIDs: ReadonlySet<string>,
  visibleAnnotationGroupUIDs: ReadonlySet<string>,
): Array<HoveredFeature<R>> {
  const unique = new Map<string, HoveredFeature<R>>()
  for (const feature of features) {
    if (!unique.has(feature.roi.uid)) unique.set(feature.roi.uid, feature)
  }
  return Array.from(unique.values()).filter(({ roi, annotationGroupUID }) =>
    annotationGroupUID !== null
      ? visibleAnnotationGroupUIDs.has(annotationGroupUID)
      : visibleRoiUIDs.has(roi.uid),
  )
}

/** Order-independent identity of a set of hovered features. */
export function hoveredFeaturesSignature<R extends { uid: string }>(
  features: ReadonlyArray<HoveredFeature<R>>,
): string {
  return features
    .map(
      ({ roi, annotationGroupUID }) => `${roi.uid}:${annotationGroupUID ?? ''}`,
    )
    .sort((a, b) => a.localeCompare(b))
    .join('|')
}

/** Tooltip rows grouped by series description, in first-seen order. */
export function groupHoveredRoisBySeries(
  rois: readonly HoveredRoi[],
): Array<[string, HoveredRoi[]]> {
  const groups = new Map<string, HoveredRoi[]>()
  for (const roi of rois) {
    const key =
      roi.seriesDescription !== '' ? roi.seriesDescription : UNKNOWN_SERIES
    groups.set(key, [...(groups.get(key) ?? []), roi])
  }
  return Array.from(groups)
}

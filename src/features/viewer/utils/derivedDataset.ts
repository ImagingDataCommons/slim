import { StorageClasses } from '../../../data/uids'

/** What the viewer shows for a derived dataset opened through the URL */
export type DerivedDatasetKind =
  | { kind: 'rois' }
  | { kind: 'annotationGroups' }
  | { kind: 'segments' }
  | { kind: 'mappings' }
  | { kind: 'opticalPaths' }
  /** Recognized but not displayed yet */
  | { kind: 'unsupported'; label: string }
  | { kind: 'unknown' }

const UNSUPPORTED_LABELS: Readonly<Record<string, string>> = {
  [StorageClasses.COMPREHENSIVE_SR]: 'Comprehensive SR',
  [StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE]:
    'Advanced Blending Presentation State',
  [StorageClasses.COLOR_SOFTCOPY_PRESENTATION_STATE]:
    'Color Softcopy Presentation State',
  [StorageClasses.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE]:
    'Grayscale Softcopy Presentation State',
  [StorageClasses.PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE]:
    'Pseudocolor Softcopy Presentation State',
}

export function classifyDerivedDataset(
  sopClassUID: string,
): DerivedDatasetKind {
  switch (sopClassUID) {
    case StorageClasses.COMPREHENSIVE_3D_SR:
      return { kind: 'rois' }
    case StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION:
      return { kind: 'annotationGroups' }
    case StorageClasses.SEGMENTATION:
    case StorageClasses.LABELMAP_SEGMENTATION:
      return { kind: 'segments' }
    case StorageClasses.PARAMETRIC_MAP:
      return { kind: 'mappings' }
    case StorageClasses.OPTICAL_PATH:
      return { kind: 'opticalPaths' }
  }
  return Object.hasOwn(UNSUPPORTED_LABELS, sopClassUID)
    ? { kind: 'unsupported', label: UNSUPPORTED_LABELS[sopClassUID] }
    : { kind: 'unknown' }
}

export interface ReferenceFrameLike {
  FrameOfReferenceUID: string
  ContainerIdentifier: string
}

/** Whether a derived instance lies on the same slide as `reference` */
export function sharesReferenceFrame(
  item: ReferenceFrameLike,
  reference: ReferenceFrameLike,
): boolean {
  return (
    item.FrameOfReferenceUID === reference.FrameOfReferenceUID &&
    item.ContainerIdentifier === reference.ContainerIdentifier
  )
}

/** DMV names bulk annotation features `<annotation group UID>-<index>` */
export function isBulkAnnotationUid(
  roiUid: string | undefined,
  annotationGroupUids: readonly string[],
): boolean {
  return annotationGroupUids.some((uid) => roiUid?.startsWith(`${uid}-`))
}

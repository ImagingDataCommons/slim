/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { logger } from '../../../utils/logger'
import type { DerivedDataContext } from './derivedDataContext'
import { loadAnnotationGroups } from './loadAnnotationGroups'
import { loadMeasurementReports } from './loadMeasurementReports'
import { loadParametricMaps } from './loadParametricMaps'
import { loadSegmentations } from './loadSegmentations'

export type { DerivedDataContext } from './derivedDataContext'
export { notifyVisualizationError } from './derivedDataContext'
export { loadAnnotationGroups } from './loadAnnotationGroups'
export { loadMeasurementReports } from './loadMeasurementReports'
export { loadParametricMaps } from './loadParametricMaps'
export { loadSegmentations } from './loadSegmentations'

/** Derived data kinds with their own loader */
export type LoadedDerivedKind =
  | 'rois'
  | 'annotationGroups'
  | 'segments'
  | 'mappings'

/**
 * Load ROIs, annotation groups, segmentations and parametric maps. Each
 * kind reports `onSettled` as soon as its own loader settled, so a deep link
 * to a SEG does not wait for a slow bulk annotation load; `onLoaded` runs
 * once every loader settled.
 */
export function loadDerivedData(
  context: DerivedDataContext,
  {
    registerRoi,
    onSettled,
    onLoaded,
  }: {
    registerRoi: (roi: dmv.roi.ROI) => void
    onSettled?: (kind: LoadedDerivedKind) => void
    onLoaded: () => void
  },
): void {
  const settled = (
    load: Promise<void>,
    kind: LoadedDerivedKind,
  ): Promise<void> => load.finally(() => onSettled?.(kind))
  Promise.allSettled([
    settled(loadMeasurementReports(context, registerRoi), 'rois'),
    settled(loadAnnotationGroups(context), 'annotationGroups'),
    settled(loadSegmentations(context), 'segments'),
    settled(loadParametricMaps(context), 'mappings'),
  ])
    .then(() => {
      logger.debug(
        'Loaded annotations, annotation groups, segmentations, and parametric maps!',
      )
      onLoaded()
    })
    .catch((error: unknown) => {
      logger.error('Failed to add derived data:', error)
    })
}

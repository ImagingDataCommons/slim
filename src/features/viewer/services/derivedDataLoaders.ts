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

/**
 * Load ROIs, annotation groups, segmentations and parametric maps, then call
 * `onLoaded` once every loader settled.
 */
export function loadDerivedData(
  context: DerivedDataContext,
  {
    registerRoi,
    onLoaded,
  }: {
    registerRoi: (roi: dmv.roi.ROI) => void
    onLoaded: () => void
  },
): void {
  Promise.allSettled([
    loadMeasurementReports(context, registerRoi),
    loadAnnotationGroups(context),
    loadSegmentations(context),
    loadParametricMaps(context),
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

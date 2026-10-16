/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../data/uids'
import { applyDistinctFractionalSegmentPalettes } from '../../../utils/distinctOverlayColormaps'
import { logger } from '../../../utils/logger'
import { sharesReferenceFrame } from '../utils/derivedDataset'
import {
  type DerivedDataContext,
  notifyVisualizationError,
} from './derivedDataContext'
import { loadSeriesMetadata } from './loadSeriesMetadata'

/** Add the study's segmentations of this slide */
export async function loadSegmentations({
  session,
  clients,
  studyInstanceUID,
  onChange,
}: DerivedDataContext): Promise<void> {
  await loadSeriesMetadata({
    client: clients[StorageClasses.SEGMENTATION],
    studyInstanceUID,
    modality: 'SEG',
    label: 'Segmentation',
    onMetadata: (retrievedMetadata) => {
      if (session.isDestroyed) return
      const reference = session.slide.volumeImages[0]
      const segmentations = retrievedMetadata
        .map((metadata) => new dmv.metadata.Segmentation({ metadata }))
        .filter((segmentation) => sharesReferenceFrame(segmentation, reference))
      if (segmentations.length === 0) return
      try {
        session.volumeViewer.addSegments(segmentations)
        applyDistinctFractionalSegmentPalettes(session.volumeViewer)
      } catch (error: unknown) {
        notifyVisualizationError('Segmentations cannot be displayed')
        logger.error('failed to add segments: ', error)
      }
      onChange()
    },
  })
}

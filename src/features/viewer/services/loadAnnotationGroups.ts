/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../data/uids'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'
import { logger } from '../../../utils/logger'
import {
  type DerivedDataContext,
  notifyVisualizationError,
} from './derivedDataContext'
import { loadSeriesMetadata } from './loadSeriesMetadata'

/** Add the study's annotation groups, colored by their finding's ROI style */
export async function loadAnnotationGroups({
  session,
  clients,
  studyInstanceUID,
  onChange,
}: DerivedDataContext): Promise<void> {
  await loadSeriesMetadata({
    client: clients[StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION],
    studyInstanceUID,
    modality: 'ANN',
    label: 'Microscopy Bulk Simple Annotations',
    onMetadata: (retrievedMetadata) => {
      if (session.isDestroyed) return
      const { volumeViewer, roiStyles } = session
      /**
       * Each instance is added on its own: a malformed one is skipped and
       * reported once, and never keeps the others from loading or styling.
       */
      let hasFailure = false
      for (const metadata of retrievedMetadata) {
        let annotations: dmv.metadata.MicroscopyBulkSimpleAnnotations
        try {
          annotations = new dmv.metadata.MicroscopyBulkSimpleAnnotations({
            metadata,
          })
          volumeViewer.addAnnotationGroups(annotations)
        } catch (error: unknown) {
          hasFailure = true
          logger.error('failed to add annotation groups:', error)
          continue
        }
        for (const item of annotations.AnnotationGroupSequence) {
          const color = roiStyles.findingFillColor(
            codedConceptKey(item.AnnotationPropertyTypeCodeSequence[0]),
          )
          if (color === undefined) continue
          try {
            volumeViewer.setAnnotationGroupStyle(item.AnnotationGroupUID, {
              color,
            })
          } catch (error: unknown) {
            logger.error(
              `failed to style annotation group "${item.AnnotationGroupUID}":`,
              error,
            )
          }
        }
      }
      if (hasFailure) {
        notifyVisualizationError(
          'Microscopy Bulk Simple Annotations cannot be displayed.',
        )
      }
      onChange()
    },
  })
}

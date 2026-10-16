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
      for (const metadata of retrievedMetadata) {
        const annotations = new dmv.metadata.MicroscopyBulkSimpleAnnotations({
          metadata,
        })
        try {
          volumeViewer.addAnnotationGroups(annotations)
        } catch (error: unknown) {
          notifyVisualizationError(
            'Microscopy Bulk Simple Annotations cannot be displayed.',
          )
          logger.error('failed to add annotation groups:', error)
        }
        for (const item of annotations.AnnotationGroupSequence) {
          const color = roiStyles.findingFillColor(
            codedConceptKey(item.AnnotationPropertyTypeCodeSequence[0]),
          )
          if (color !== undefined) {
            volumeViewer.setAnnotationGroupStyle(item.AnnotationGroupUID, {
              color,
            })
          }
        }
      }
      onChange()
    },
  })
}

/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../data/uids'
import { applyDistinctParametricMapPalettes } from '../../../utils/distinctOverlayColormaps'
import { logger } from '../../../utils/logger'
import { sharesReferenceFrame } from '../utils/derivedDataset'
import {
  type DerivedDataContext,
  notifyVisualizationError,
} from './derivedDataContext'
import { loadSeriesMetadata } from './loadSeriesMetadata'

/** Add the study's parametric maps of this slide */
export async function loadParametricMaps({
  session,
  clients,
  studyInstanceUID,
  onChange,
}: DerivedDataContext): Promise<void> {
  await loadSeriesMetadata({
    client: clients[StorageClasses.PARAMETRIC_MAP],
    studyInstanceUID,
    modality: 'OT',
    label: 'Parametric Map',
    onMetadata: (retrievedMetadata) => {
      if (session.isDestroyed) return
      const reference = session.slide.volumeImages[0]
      const parametricMaps: dmv.metadata.ParametricMap[] = []
      for (const metadata of retrievedMetadata) {
        const parametricMap = new dmv.metadata.ParametricMap({ metadata })
        if (sharesReferenceFrame(parametricMap, reference)) {
          parametricMaps.push(parametricMap)
        } else {
          /** console.warn (not logger) so the header notifications list it */
          console.warn(
            `skip Parametric Map instance "${parametricMap.SOPInstanceUID}"`,
          )
        }
      }
      if (parametricMaps.length === 0) return
      try {
        session.volumeViewer.addParameterMappings(parametricMaps)
        applyDistinctParametricMapPalettes(session.volumeViewer)
      } catch (error: unknown) {
        notifyVisualizationError('Parametric Map cannot be displayed')
        logger.error('failed to add mappings: ', error)
      }
      onChange()
    },
  })
}

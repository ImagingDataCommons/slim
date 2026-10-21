/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import { areROIsEqual } from '../../../components/SlideViewer/utils/roiUtils'
import {
  containsROIAnnotations,
  describesSpecimenSubject,
  implementsTID1500,
} from '../../../components/SlideViewer/utils/viewerUtils'
import { StorageClasses } from '../../../data/uids'
import { logger } from '../../../utils/logger'
import { MeasurementReport } from '../../../utils/measurementReport'
import {
  type DerivedDataContext,
  notifyVisualizationError,
  toError,
} from './derivedDataContext'

/**
 * Add the ROIs of a retrieved Comprehensive 3D SR to the viewer, hidden.
 * Returns whether the document is a suitable measurement report.
 */
function addMeasurementReportRois(
  session: DerivedDataContext['session'],
  retrievedInstance: dwc.api.Dataset,
  registerRoi: (roi: dmv.roi.ROI) => void,
): boolean {
  const { volumeViewer } = session
  const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
  const { dataset } = dmv.metadata.formatMetadata(data.dict)
  const report = dataset as dmv.metadata.Comprehensive3DSR
  if (!implementsTID1500(report)) {
    logger.debug(
      `ignore SR document "${report.SOPInstanceUID}" ` +
        'because it is not structured according to template ' +
        'TID 1500 "MeasurementReport"',
    )
    return false
  }
  if (!describesSpecimenSubject(report)) {
    logger.debug(
      `ignore SR document "${report.SOPInstanceUID}" ` +
        'because it does not describe a specimen subject',
    )
    return false
  }
  if (!containsROIAnnotations(report)) {
    logger.debug(
      `ignore SR document "${report.SOPInstanceUID}" ` +
        'because it does not contain any suitable ROI annotations',
    )
    return false
  }

  const frameOfReferenceUID = session.slide.volumeImages[0].FrameOfReferenceUID
  for (const roi of new MeasurementReport(report).ROIs) {
    logger.log(`add ROI "${roi.uid}"`)
    if (roi.scoord3d.frameOfReferenceUID !== frameOfReferenceUID) {
      logger.debug(
        `skip ROI "${roi.uid}" ` +
          `of SR document "${report.SOPInstanceUID}"` +
          'because it is defined in another frame of reference',
      )
      continue
    }
    /**
     * The same ROI may be stored in several SR documents, and ROIs may get
     * new UIDs when the page is rendered again, so compare geometries.
     */
    const exists = volumeViewer
      .getAllROIs()
      .some((other: dmv.roi.ROI) => areROIsEqual(other, roi))
    if (exists) {
      logger.debug(`skip already existing ROI "${roi.uid}"`)
      continue
    }
    try {
      /** Added without style so that it stays hidden */
      volumeViewer.addROI(roi, {})
      registerRoi(roi)
    } catch {
      logger.error(`could not add ROI "${roi.uid}"`)
    }
  }
  return true
}

/**
 * Add the ROIs of the study's measurement reports in this slide's frame of
 * reference. Settles as soon as a suitable report was added, so derived-data
 * auto-show does not wait on slow retrieves, or else once every
 * Comprehensive 3D SR was handled, including unsuitable documents and
 * retrieve or parse failures. Reports added later still call `onChange`.
 * Failures are reported to the user once, after every retrieve settled.
 */
/** Errors of a viewer that is gone are not shown over the next one */
function notifyUnlessDestroyed(
  session: DerivedDataContext['session'],
  message: string,
): void {
  if (!session.isDestroyed) notifyVisualizationError(message)
}

export async function loadMeasurementReports(
  { session, clients, studyInstanceUID, onChange }: DerivedDataContext,
  registerRoi: (roi: dmv.roi.ROI) => void,
): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    logger.log('search for Comprehensive 3D SR instances')
    const client = clients[StorageClasses.COMPREHENSIVE_3D_SR]
    client
      .searchForInstances({
        studyInstanceUID,
        queryParams: { Modality: 'SR' },
      })
      .then((matchedInstances): void => {
        const toRetrieve: dmv.metadata.Instance[] = []
        for (const rawInstance of matchedInstances ?? []) {
          const { dataset } = dmv.metadata.formatMetadata(rawInstance)
          const instance = dataset as dmv.metadata.Instance
          if (instance.SOPClassUID === StorageClasses.COMPREHENSIVE_3D_SR) {
            toRetrieve.push(instance)
          }
        }
        if (toRetrieve.length === 0) {
          resolve()
          return
        }
        /**
         * Also resolve once every retrieve settled so onLoaded can show
         * SEG/ANN/PM/SR even when no report is suitable.
         */
        let pendingCount = toRetrieve.length
        let hasFailure = false
        const finishOne = (): void => {
          pendingCount -= 1
          if (pendingCount > 0) return
          if (hasFailure) {
            notifyUnlessDestroyed(session, 'Annotations could not be loaded')
          }
          resolve()
        }
        for (const instance of toRetrieve) {
          logger.log(`retrieve SR instance "${instance.SOPInstanceUID}"`)
          client
            .retrieveInstance({
              studyInstanceUID,
              seriesInstanceUID: instance.SeriesInstanceUID,
              sopInstanceUID: instance.SOPInstanceUID,
            })
            .then((retrievedInstance): void => {
              if (!session.isDestroyed) {
                try {
                  if (
                    addMeasurementReportRois(
                      session,
                      retrievedInstance,
                      registerRoi,
                    )
                  ) {
                    onChange()
                    resolve()
                  }
                } catch (error: unknown) {
                  hasFailure = true
                  logger.error(
                    'failed to parse ROIs ' +
                      `of SOP instance "${instance.SOPInstanceUID}" ` +
                      `of series "${instance.SeriesInstanceUID}" ` +
                      `of study "${studyInstanceUID}": `,
                    error,
                  )
                }
              }
              finishOne()
            })
            .catch((error: unknown) => {
              hasFailure = true
              logger.error(
                'failed to load ROIs ' +
                  `of SOP instance "${instance.SOPInstanceUID}" ` +
                  `of series "${instance.SeriesInstanceUID}" ` +
                  `of study "${studyInstanceUID}": `,
                error,
              )
              finishOne()
            })
        }
      })
      .catch((error: unknown) => {
        logger.error(error)
        notifyUnlessDestroyed(session, 'Annotations could not be loaded')
        reject(toError(error))
      })
  })
}

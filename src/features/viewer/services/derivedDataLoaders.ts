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
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../utils/CustomError'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'
import {
  applyDistinctFractionalSegmentPalettes,
  applyDistinctParametricMapPalettes,
} from '../../../utils/distinctOverlayColormaps'
import { logger } from '../../../utils/logger'
import { MeasurementReport } from '../../../utils/measurementReport'
import { sharesReferenceFrame } from '../utils/derivedDataset'
import type { ViewerSession } from './viewerSession'

export interface DerivedDataContext {
  session: ViewerSession
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  /** Called once the viewer holds new items the panels list */
  onChange: () => void
}

export function notifyVisualizationError(message: string): void {
  NotificationMiddleware.onError(
    NotificationMiddlewareContext.SLIM,
    new CustomError(errorTypes.VISUALIZATION, message),
  )
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Add the ROIs of a retrieved Comprehensive 3D SR to the viewer, hidden.
 * Returns whether the document is a suitable measurement report.
 */
function addMeasurementReportRois(
  session: ViewerSession,
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
 * reference. Settles once a suitable report was added (or none exist);
 * studies holding only unsuitable reports never settle.
 */
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
        const instances = matchedInstances ?? []
        if (instances.length === 0) {
          resolve()
          return
        }
        for (const rawInstance of instances) {
          const { dataset } = dmv.metadata.formatMetadata(rawInstance)
          const instance = dataset as dmv.metadata.Instance
          if (instance.SOPClassUID !== StorageClasses.COMPREHENSIVE_3D_SR) {
            continue
          }
          logger.log(`retrieve SR instance "${instance.SOPInstanceUID}"`)
          client
            .retrieveInstance({
              studyInstanceUID,
              seriesInstanceUID: instance.SeriesInstanceUID,
              sopInstanceUID: instance.SOPInstanceUID,
            })
            .then((retrievedInstance): void => {
              if (session.isDestroyed) {
                resolve()
                return
              }
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
            })
            .catch((error: unknown) => {
              notifyVisualizationError('Annotations could not be loaded')
              logger.error(
                'failed to load ROIs ' +
                  `of SOP instance "${instance.SOPInstanceUID}" ` +
                  `of series "${instance.SeriesInstanceUID}" ` +
                  `of study "${studyInstanceUID}": `,
                error,
              )
            })
        }
      })
      .catch((error: unknown) => {
        logger.error(error)
        notifyVisualizationError('Annotations could not be loaded')
        reject(toError(error))
      })
  })
}

/**
 * Search the study's series of one modality and pass each series' metadata
 * to `onMetadata`. Settles once every series was handled.
 */
async function loadSeriesMetadata({
  client,
  studyInstanceUID,
  modality,
  label,
  onMetadata,
}: {
  client: DicomWebManager
  studyInstanceUID: string
  modality: string
  /** Name of the instances in log and error messages */
  label: string
  onMetadata: (metadata: dwc.api.Metadata[]) => void
}): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    logger.log(`search for ${label} instances`)
    client
      .searchForSeries({
        studyInstanceUID,
        queryParams: { Modality: modality },
      })
      .then((matchedSeries): void => {
        const seriesList = matchedSeries ?? []
        if (seriesList.length === 0) {
          resolve()
          return
        }
        /**
         * Resolve only after every series settled, so the URL-targeted
         * series is in the viewer before derived data is shown.
         */
        let pendingSeriesCount = seriesList.length
        const finishOne = (): void => {
          pendingSeriesCount -= 1
          if (pendingSeriesCount === 0) resolve()
        }
        for (const rawSeries of seriesList) {
          const { dataset } = dmv.metadata.formatMetadata(rawSeries)
          const series = dataset as dmv.metadata.Series
          client
            .retrieveSeriesMetadata({
              studyInstanceUID,
              seriesInstanceUID: series.SeriesInstanceUID,
            })
            .then((metadata): void => {
              onMetadata(metadata)
              finishOne()
            })
            .catch((error: unknown) => {
              logger.error(error)
              notifyVisualizationError(
                `Retrieval of metadata of ${label} instances failed.`,
              )
              finishOne()
            })
        }
      })
      .catch((error: unknown) => {
        logger.error(error)
        notifyVisualizationError(`Search for ${label} instances failed.`)
        reject(toError(error))
      })
  })
}

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

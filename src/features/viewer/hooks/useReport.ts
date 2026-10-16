/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useState } from 'react'

import type { SlideViewerProps } from '../../../components/SlideViewer/types'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import NotificationMiddleware, {
  ERROR_TOAST_OPTIONS,
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import type { AppInfo } from '../../../utils/appInfo'
import { CustomError, errorTypes } from '../../../utils/CustomError'
import { encodeDicomDataset } from '../../../utils/encodeDicomDataset'
import generateReport from '../../../utils/generateReport'
import { logger } from '../../../utils/logger'
import { publishToast } from '../services/toast'
import type { ViewerSessionRef } from '../services/viewerSession'
import type { ViewerInteractionAction } from '../utils/viewerInteraction'

export interface ReportApi {
  /** Report awaiting the user's verification */
  report: dmv.metadata.Comprehensive3DSR | undefined
  onGenerate: () => void
  onVerify: () => void
  onCancel: () => void
}

/** Measurement report of the visible ROIs: preview, then store */
export function useReport({
  sessionRef,
  clients,
  app,
  user,
  visibleRoiUIDs,
  dispatch,
}: {
  sessionRef: ViewerSessionRef
  clients: { [key: string]: DicomWebManager }
  app: AppInfo
  user: SlideViewerProps['user']
  visibleRoiUIDs: Set<string>
  dispatch: React.Dispatch<ViewerInteractionAction>
}): ReportApi {
  const [report, setReport] = useState<
    dmv.metadata.Comprehensive3DSR | undefined
  >(undefined)

  const close = (): void => {
    dispatch({ type: 'setReportModalVisible', isVisible: false })
    setReport(undefined)
  }

  /** Encoding errors only reach the console and Debug log, so toast it too */
  const notifySaveFailed = (error: unknown): void => {
    logger.error(error)
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(
        errorTypes.ENCODINGANDDECODING,
        'Annotations could not be saved',
      ),
    )
    publishToast(
      'Annotations could not be saved.',
      'error',
      undefined,
      ERROR_TOAST_OPTIONS,
    )
  }

  return {
    report,
    onGenerate: () => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log('save ROIs')
      const opticalPaths = viewer.getAllOpticalPaths()
      let generated: ReturnType<typeof generateReport>
      try {
        generated = generateReport({
          rois: viewer.getAllROIs(),
          metadata: viewer.getOpticalPathMetadata(opticalPaths[0].identifier),
          user,
          app,
          visibleRoiUIDs,
        })
      } catch (error: unknown) {
        /** dcmjs throws on SR content it can't encode; without this the click does nothing */
        notifySaveFailed(error)
        return
      }
      setReport(generated.generatedReport)
      dispatch({
        type: 'setReportModalVisible',
        isVisible: generated.isReportModalVisible,
      })
    },
    onVerify: () => {
      logger.log('verify report generation')
      if (report !== undefined) {
        const client = clients[StorageClasses.COMPREHENSIVE_3D_SR]
        Promise.resolve()
          .then(() =>
            client.storeInstances({
              datasets: [encodeDicomDataset(report, app.uid)],
            }),
          )
          .then(() => publishToast('Annotations were saved.', 'success'))
          .catch(notifySaveFailed)
      }
      close()
    },
    onCancel: close,
  }
}

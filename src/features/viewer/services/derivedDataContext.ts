import type DicomWebManager from '../../../DicomWebManager'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../utils/CustomError'
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

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

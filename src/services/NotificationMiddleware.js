import PubSub from '../utils/PubSub'
import { notification } from 'antd'

export const NotificationMiddlewareEvents = {
  OnError: 'onError'
}

export const NotificationMiddlewareContext = {
  DICOMWEB: 'dicomweb-client',
  DMV: 'dicom-microscopy-viewer',
  DCMJS: 'dcmjs',
  SLIM: 'slim'
}

const NotificationType = {
  TOAST: 'toast',
  CONSOLE: 'console'
}

const NotificationCategory = {
  SERVER: 'Server',
  VIEWER: 'Viewer',
  PARSING: 'Parsing'
}

/* Sources of Error:
  1. 'dicomweb-client': Server related error: Error while fetching data, tagged as 'Server'
  2. 'slim' and 'dcmjs' library: Syntactical/Logical/Data parsing error, tagged as 'Parsing'
  3. 'dicom-microscopy-viewer' library: Data manipulation error, tagged as 'Viewer'
  */
const NotificationSourceDefinition = {
  sources: [
    {
      name: NotificationMiddlewareContext.DICOMWEB,
      notificationType: NotificationType.TOAST,
      category: NotificationCategory.SERVER
    },
    {
      name: NotificationMiddlewareContext.DMV,
      notificationType: NotificationType.TOAST,
      category: NotificationCategory.VIEWER
    },
    {
      name: NotificationMiddlewareContext.DCMJS,
      notificationType: NotificationType.TOAST,
      category: NotificationCategory.PARSING
    },
    {
      name: NotificationMiddlewareContext.SLIM,
      notificationType: NotificationType.TOAST,
      category: NotificationCategory.PARSING
    }
  ]
}

class NotificationMiddleware extends PubSub {

  /**
 * Error handling middleware function
 *
 * @param source - source of error - dicomweb-client, dmv, dcmjs or slim itself
 * @param error - error object
 */
  onError (source, error) {
    const sourceConfig = NotificationSourceDefinition.sources.find(
      s => s.name === source
    )
    const { notificationType, category } = sourceConfig

    this.publish(NotificationMiddlewareEvents.OnError, {
      source,
      error,
      category
    })

    let notificationMsg
    if (error instanceof Error) {
      notificationMsg = error.message
    } else {
      notificationMsg = String(error)
    }

    switch (notificationType) {
      case NotificationType.TOAST:
        console.error(`An error occured in ${category}`, error)
        return notification.error({
          message: `${category} error`,
          description: notificationMsg,
          duration: 3
        })

      case NotificationType.CONSOLE:
        console.error(`An error occured in ${category}`, error)
        return

      default:
        return
    }
  }
}

export default new NotificationMiddleware()

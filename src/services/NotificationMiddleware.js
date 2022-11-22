import PubSub from '../utils/PubSub'
import { notification } from 'antd'

const ErrorMiddlewareEvents = {
  OnError: 'onError'
}

export const NotificationMiddlewareContext = {
  DICOMWEB: 'dicomweb-client',
  DMV: 'dicom-microscopy-viewer',
  DCMJS: 'dcmjs',
  SLIM: 'slim'
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
      notificationType: 'toast',
      category: 'Server'
    },
    {
      name: NotificationMiddlewareContext.DMV,
      notificationType: 'toast',
      category: 'Viewer'
    },
    {
      name: NotificationMiddlewareContext.DCMJS,
      notificationType: 'toast',
      category: 'Parsing'
    },
    {
      name: NotificationMiddlewareContext.SLIM,
      notificationType: 'toast',
      category: 'Parsing'
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
  onError(source, error) {
    const sourceConfig = NotificationSourceDefinition.sources.find(
      s => s.name === source
    )
    const { notificationType, category } = sourceConfig

    this.publish(ErrorMiddlewareEvents.OnError, {
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
      case 'toast':
        console.error(`An error occured in ${category}`, error)
        return notification.error({
          message: `${category} error`,
          description: notificationMsg,
          duration: 3
        })

      case 'console':
        console.error(`An error occured in ${category}`, error)
        return

      default:
        return
    }
  }
}

export default new NotificationMiddleware()

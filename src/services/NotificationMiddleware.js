import PubSub from '../utils/PubSub'
import { notification } from 'antd'
import { CustomError, errorTypes } from '../utils/CustomError'

export const NotificationMiddlewareEvents = {
  OnError: 'onError',
  OnWarning: 'onWarning'
}

export const NotificationMiddlewareContext = {
  DICOMWEB: 'dicomweb-client',
  DMV: 'dicom-microscopy-viewer',
  DCMJS: 'dcmjs',
  SLIM: 'slim',
  AUTH: 'authentication'
}

const NotificationType = {
  TOAST: 'toast',
  CONSOLE: 'console'
}

/* Sources of Error:
  1. 'dicomweb-client': Error while requesting/fetching data, tagged as 'Communication'
  2. 'slim' and 'dicom-microscopy-viewer' library: Error related to dicom data encoding/decoding,
  could directly/indirectly impact image-related visualization, tagged as 'Visualization' or
  'Encoding/Decoding' accordingly
  3. 'dcmjs' library: Data parsing error, tagged as 'DICOMError'
  4. 'authentication': Error during user authentication, tagged as 'Authentication'
  */
const NotificationSourceDefinition = {
  sources: [
    {
      category: errorTypes.AUTHENTICATION,
      notificationType: NotificationType.TOAST
    },
    {
      category: errorTypes.COMMUNICATION,
      notificationType: NotificationType.TOAST
    },
    {
      category: errorTypes.VISUALIZATION,
      notificationType: NotificationType.TOAST
    },
    {
      category: errorTypes.ENCODINGANDDECODING,
      notificationType: NotificationType.CONSOLE
    },
    {
      category: 'Warning',
      notificationType: NotificationType.TOAST
    }
  ]
}

class NotificationMiddleware extends PubSub {
  constructor () {
    super()

    const outerContext = (args) => {
      this.publish(NotificationMiddlewareEvents.OnWarning, Array.from(args).join(' '))
    }

    (function () {
      const warn = console.warn
      console.warn = function () {
        if (!JSON.stringify(arguments).includes('request')) {
          outerContext(arguments)
        }
        warn.apply(this, Array.prototype.slice.call(arguments))
      }
    }())
  }

  /**
   * Error handling middleware function
   *
   * @param source - source of error - dicomweb-client, dmv, dcmjs or slim itself
   * @param error - error object
   */
  onError (source, error) {
    const errorCategory = error.type
    const sourceConfig = NotificationSourceDefinition.sources.find(
      s => s.category === errorCategory
    )

    const { notificationType } = sourceConfig

    this.publish(NotificationMiddlewareEvents.OnError, {
      source,
      error
    })

    let notificationMsg
    if (error instanceof CustomError) {
      notificationMsg = error.message
    } else {
      notificationMsg = String(error)
    }

    switch (notificationType) {
      case NotificationType.TOAST:
        console.error(`A ${errorCategory} error occurred: `, error)
        return notification.error({
          message: `${errorCategory} error`,
          description: notificationMsg,
          duration: 3
        })

      case NotificationType.CONSOLE:
        console.error(`A ${errorCategory} error occurred: `, error)
        break

      default:
    }
  }
}

export default new NotificationMiddleware()

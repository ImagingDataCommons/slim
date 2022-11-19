import CustomPubSub from "./CustomPubSub";
import { notification } from "antd";

const ErrorMiddlewareEvents = {
  OnError: "onError",
};

/* Sources of Error:
  1. 'dicomweb-client': Server related error: Error while fetching data, tagged as 'Server'
  2. 'slim' and 'dcmjs' library: Syntactical/Logical/Data parsing error, tagged as 'Parsing'
  3. 'dicom-microscopy-viewer' library: Data manipulation error, tagged as 'Viewer'
  */
const NotificationSourceDefinition = {
  sources: [
    {
      name: "dicomweb-client",
      notificationType: "toast",
      category: "Server",
    },
    {
      name: "dicom-microscopy-viewer",
      notificationType: "toast",
      category: "Viewer",
    },
    {
      name: "dcmjs",
      notificationType: "toast",
      category: "Parsing",
    },
    {
      name: "slim",
      notificationType: "toast",
      category: "Parsing",
    },
  ],
};

class ErrorMiddleware extends CustomPubSub {
  onError(source, error) {
    const sourceConfig = NotificationSourceDefinition.sources.find(
      (s) => s.name === source
    );
    const { notificationType, category } = sourceConfig;

    this.publish(ErrorMiddlewareEvents.OnError, {
      source,
      error,
      category
    });

    let notificationMsg;
    if (error instanceof Error) {
      notificationMsg = error.message;
    } else {
      notificationMsg = String(error);
    }

    switch (notificationType) {
      case "toast":
        console.error(`An error occured in ${category}`, error);
        return notification.error({
          message: `${category} error`,
          description: notificationMsg,
          duration: 3,
        });

      case "console":
        console.error(`An error occured in ${category}`, error);
        return;

      default:
        return;
    }
  }
}

export default new ErrorMiddleware();

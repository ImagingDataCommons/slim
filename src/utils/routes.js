import URLUtils from "./url";

const parsePath = (path, server, params) => {
  let _path = path;
  const _paramsCopy = Object.assign({}, server, params);

  for (let key in _paramsCopy) {
    _path = URLUtils.paramString.replaceParam(_path, key, _paramsCopy[key]);
  }

  return _path;
};

const parseViewerPath = (appConfig = {}, server = {}, params) => {
  let viewerPath = "/studies/:studyInstanceUID";

  if (appConfig.enableGoogleCloudAdapter) {
    viewerPath =
      "/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore/study/:studyInstanceUID";
  }

  return parsePath(viewerPath, server, params);
};

const updateViewerURL = (appConfig, server, history, studyInstanceUID) => {
  const viewerPath = parseViewerPath(appConfig, server, {
    studyInstanceUID
  });

  if (URLUtils.paramString.isValidPath(viewerPath)) {
    history.push(viewerPath);
  }
};

const parseWorklistPath = (appConfig, server) => {
  let worklistPath = appConfig.routerBasename;

  if (appConfig.enableGoogleCloudAdapter) {
    worklistPath =
      "/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore" ||
      worklistPath;
  }

  return parsePath(worklistPath, server);
};

const updateWorklistURL = (appConfig, server, history) => {
  const listPath = parseWorklistPath(appConfig, server);

  if (URLUtils.paramString.isValidPath(listPath)) {
    const { location = {} } = history;
    if (location.pathname !== listPath) {
      history.replace(listPath);
    }
  }
};

export default { parsePath, updateWorklistURL, updateViewerURL };

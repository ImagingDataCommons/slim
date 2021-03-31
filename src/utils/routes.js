import URLUtils from "./url";

const parsePath = (path, server, params) => {
  let _path = path;
  const _paramsCopy = Object.assign({}, server, params);

  for (let key in _paramsCopy) {
    _path = URLUtils.paramString.replaceParam(_path, key, _paramsCopy[key]);
  }

  return _path;
};

const updateViewerURL = (appConfig, server, history, params, state) => {
  let viewerPath = "/studies/:studyInstanceUID";

  if (appConfig.enableGoogleCloudAdapter) {
    viewerPath =
      "/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore/study/:studyInstanceUID";
  }

  viewerPath = parsePath(viewerPath, server, params);

  if (URLUtils.paramString.isValidPath(viewerPath)) {
    history.push({ pathname: viewerPath, state });
  }
};

const updateWorklistURL = (appConfig, server, history, params) => {
  let worklistPath = appConfig.routerBasename;

  if (appConfig.enableGoogleCloudAdapter) {
    worklistPath =
      "/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore" ||
      worklistPath;
  }

  worklistPath = parsePath(worklistPath, server, params);

  if (URLUtils.paramString.isValidPath(worklistPath)) {
    const { location = {} } = history;
    if (location.pathname !== worklistPath) {
      history.replace(worklistPath);
    }
  }
};

export default { parsePath, updateWorklistURL, updateViewerURL };

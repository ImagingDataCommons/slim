import URLUtils from "../url";

const parseWorklistPath = (path, server, params) => {
  let _path = path;
  const _paramsCopy = Object.assign({}, server, params);
  for (let key in _paramsCopy) {
    _path = URLUtils.paramString.replaceParam(_path, key, _paramsCopy[key]);
  }
  return _path;
};

const updateWorklistURL = (appConfig, server, history) => {
  let worklistPath = appConfig.routerBasename;
  if (appConfig.enableGoogleCloudAdapter) {
    worklistPath =
      "/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore" ||
      worklistPath;
  }

  const listPath = parseWorklistPath(worklistPath, server);
  if (URLUtils.paramString.isValidPath(listPath)) {
    const { location = {} } = history;
    if (location.pathname !== listPath) {
      history.replace(listPath);
    }
  }
};

export default updateWorklistURL;

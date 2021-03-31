import React, { useEffect } from "react";

/** Components */
import GoogleCloudApi from "../google/api/GoogleCloudApi";

/** Utils */
import {
  getServers as getGoogleServers,
  isValidServer as isValidGoogleServer,
  isEqualServer,
} from "../google/utils";

/** Hooks */
import { usePrevious } from "../hooks";

/** Providers */
import { useApp } from "../providers/AppProvider";
import { useServer } from "../providers/ServerProvider";

const getActiveServer = (servers) => {
  const isActive = (a) => a.active === true;
  return servers && servers && servers.find(isActive);
};

const getServersByParams = (
  appConfig,
  project,
  location,
  dataset,
  dicomStore
) => {
  let servers = [];

  if (appConfig.enableGoogleCloudAdapter) {
    GoogleCloudApi.urlBase = appConfig.healthcareApiEndpoint;
    const pathUrl = GoogleCloudApi.getUrlBaseDicomWeb(
      project,
      location,
      dataset,
      dicomStore
    );
    const data = {
      name: dicomStore,
      project,
      location,
      dataset,
      dicomStore,
      wadoUriRoot: pathUrl,
      qidoRoot: pathUrl,
      wadoRoot: pathUrl,
    };
    servers = getGoogleServers(data);
    if (!isValidServer(servers[0], appConfig)) {
      return;
    }
  }

  return servers;
};

const isValidServer = (server, appConfig) => {
  if (appConfig.enableGoogleCloudAdapter) {
    return isValidGoogleServer(server);
  }

  return !!server;
};

const _useServerFromURL = (
  servers = [],
  previousServers,
  activeServer,
  urlBasedServers,
  appConfig
) => {
  /** Update state from url available only when gcloud on */
  if (!appConfig.enableGoogleCloudAdapter) {
    return false;
  }

  /** do not update from url, use state instead */
  const serverHasChanged = previousServers !== servers && previousServers;
  if (serverHasChanged) {
    return false;
  }

  /** if no valid url based servers */
  if (!urlBasedServers || !urlBasedServers.length) {
    return false;
  } else if (!servers.length || !activeServer) {
    /** no current valid server */
    return true;
  }

  const newServer = urlBasedServers[0];
  let exists = servers.some(isEqualServer.bind(undefined, newServer));
  return !exists;
};

export default function useServerFromURL({
  project,
  location,
  dataset,
  dicomStore,
} = {}) {
  const { servers, setServers } = useServer();
  const previousServers = usePrevious(servers);
  const { config: appConfig = {} } = useApp();

  useEffect(() => {
    const activeServer = getActiveServer(servers);
    const urlBasedServers =
      getServersByParams(appConfig, project, location, dataset, dicomStore) ||
      [];
    const shouldUpdateServer = _useServerFromURL(
      servers,
      previousServers,
      activeServer,
      urlBasedServers,
      appConfig
    );
    if (shouldUpdateServer) {
      setServers(urlBasedServers);
    }
  }, [project, location, dataset, dicomStore]);

  return getActiveServer(servers);
}

/**
 * A public higher-order component to access the imperative API
 *
 * @param {function} Component React component
 * @returns {function} React component
 */
export const withServerFromURL = (Component) => {
  return function WrappedComponent(props) {
    const { project, location, dataset, dicomStore } = props.match.params;
    const server = useServerFromURL({ project, location, dataset, dicomStore });
    return <Component {...props} />;
  };
};

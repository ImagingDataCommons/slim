import React, { useContext } from "react";
import * as dwc from "dicomweb-client";

/** Utils */
import { getAuthorizationHeader } from "../utils";

/** Providers */
import { useAuth } from './AuthProvider';

const DataStoreContext = React.createContext({});

export const useDataStore = () => useContext(DataStoreContext);

const DataStoreProvider = ({ children, appConfig }) => {
  const { user } = useAuth();

  /** TODO: Consume server from useServer instead */
  const server = appConfig.servers.dicomWeb[0];
  const config = {
    url: server.qidoRoot,
    headers: getAuthorizationHeader(server.qidoRoot, user),
  };
  const client = new dwc.api.DICOMwebClient(config);

  const searchForInstances = (args) => {
    return client.searchForInstances(args);
  };

  const searchForStudies = (args) => {
    return client.searchForStudies(args);
  };

  const searchForSeries = (args) => {
    return client.searchForSeries(args);
  };

  const retrieveInstanceMetadata = (args) => {
    return client.retrieveInstanceMetadata(args);
  };

  const retrieveSeriesMetadata = (args) => {
    return client.retrieveSeriesMetadata(args);
  };

  const retrieveInstanceFrames = (args) => {
    return client.retrieveInstanceFrames(args);
  };

  const storeInstances = (args) => {
    return client.storeInstances(args);
  };

  return (
    <DataStoreContext.Provider
      value={{
        storeInstances,
        retrieveInstanceMetadata,
        retrieveSeriesMetadata,
        retrieveInstanceFrames,
        searchForInstances,
        searchForStudies,
        searchForSeries,
      }}
    >
      {children}
    </DataStoreContext.Provider>
  );
};

export const withDataStore = (Component) => {
  return function WrappedComponent(props) {
    const {
      storeInstances,
      retrieveInstanceMetadata,
      retrieveSeriesMetadata,
      retrieveInstanceFrames,
      searchForInstances,
      searchForStudies,
      searchForSeries,
    } = useDataStore();
    return (
      <Component
        {...props}
        dataStore={{
          storeInstances,
          retrieveInstanceMetadata,
          retrieveSeriesMetadata,
          retrieveInstanceFrames,
          searchForInstances,
          searchForStudies,
          searchForSeries,
        }}
      />
    );
  };
};

export default DataStoreProvider;

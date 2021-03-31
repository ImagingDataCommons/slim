import React, { useContext } from "react";
import * as dwc from "dicomweb-client";

/** Utils */
import { getAuthorizationHeader } from "../utils";

/** Providers */
import { useAuth } from "./AuthProvider";
import { useServer } from "./ServerProvider";

const DataStoreContext = React.createContext({});

export const useDataStore = () => useContext(DataStoreContext);

const DataStoreProvider = ({ children }) => {
  const { user } = useAuth();
  const { servers } = useServer();

  const server = servers.find((s) => !!s.active);

  if (!server) return null;

  const client = new dwc.api.DICOMwebClient({
    url: server.qidoRoot,
    headers: getAuthorizationHeader(server.qidoRoot, user),
  });

  const api = {
    searchForInstances: (args) => client.searchForInstances(args),
    searchForStudies: (args) => client.searchForStudies(args),
    searchForSeries: (args) => client.searchForSeries(args),
    retrieveInstanceMetadata: (args) => client.retrieveInstanceMetadata(args),
    retrieveSeriesMetadata: (args) => client.retrieveSeriesMetadata(args),
    retrieveInstanceFrames: (args) => client.retrieveInstanceFrames(args),
    storeInstances: (args) => client.storeInstances(args),
  };

  return (
    <DataStoreContext.Provider value={api}>
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

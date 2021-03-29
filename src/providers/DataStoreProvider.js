import React, { useContext } from "react";
import * as dwc from "dicomweb-client";

/** Providers */
import { useApp } from "./AppProvider";

/** Utils */
import { getAuthorizationHeader } from "../utils";

const DataStoreContext = React.createContext({});

export const useDataStore = () => useContext(DataStoreContext);

const DataStoreProvider = ({ children }) => {
  const { config: appConfig } = useApp();

  // if (props.dicomwebUrl !== undefined) {
  //   this.clientConfig = {
  //     url: props.dicomwebUrl,
  //     headers: {},
  //   };
  // } else if (props.dicomwebPath !== undefined) {
  //   this.clientConfig = {
  //     url: `${window.location.origin}${props.dicomwebPath}`,
  //     headers: {},
  //   };
  // } else {
  //   throw new Error("Either DICOMweb path or full URL needs to be provided.");
  // }

  // if (props.qidoPathPrefix !== undefined) {
  //   this.clientConfig.qidoUrlPrefix = props.qidoPathPrefix;
  // }

  // if (props.wadoPathPrefix !== undefined) {
  //   this.clientConfig.wadoUrlPrefix = props.wadoPathPrefix;
  // }

  // this.state = {
  //   /** Sets token headers on login like ohif */
  //   client: new dwc.api.DICOMwebClient(this.clientConfig),
  // };

  const server = appConfig.servers.dicomWeb[0]; // use useServer
  const config = {
    url: server.qidoRoot,
    headers: getAuthorizationHeader(server.qidoRoot),
    // errorInterceptor
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
        searchForSeries
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
      searchForSeries
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
          searchForSeries
        }}
      />
    );
  };
};

export default DataStoreProvider;

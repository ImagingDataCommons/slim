import React, { useContext, useEffect, useReducer } from "react";
import uniqBy from "lodash/uniqBy";

const ServerContext = React.createContext({});

export const useServer = () => useContext(ServerContext);

const defaultState = {
  servers: [],
};

const ServerProvider = ({ children, appConfig }) => {
  const servers = appConfig.servers;

  const reducer = (state, action) => {
    switch (action.type) {
      case "ADD_SERVER":
        let servers = uniqBy([...state.servers, action.server], "id");
        servers.forEach((s) => (s.active = true));
        return { ...state, servers };

      case "ACTIVATE_SERVER": {
        const newServer = { ...action.server, active: true };
        const newServers = state.servers;
        newServers.forEach((s) => (s.active = false));
        return {
          ...state,
          servers: uniqBy([...newServers, newServer], "wadoRoot"),
        };
      }

      case "SET_SERVERS":
        return { ...state, servers: action.servers };

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, defaultState);

  useEffect(() => {
    const init = (servers) => {
      if (!servers) {
        throw new Error("Servers must be defined");
      }

      Object.keys(servers).forEach((serverType) => {
        const endpoints = servers[serverType];
        endpoints.forEach((endpoint) => {
          const server = Object.assign({}, endpoint);
          server.type = serverType;
          addServer(server);
        });
      });
    };

    init(servers);
  }, [servers]);

  const activateServer = (server) =>
    dispatch({
      type: "ACTIVATE_SERVER",
      server,
    });

  const setServers = (servers) =>
    dispatch({
      type: "SET_SERVERS",
      servers,
    });

  const addServer = (server) =>
    dispatch({
      type: "ADD_SERVER",
      server,
    });

  return (
    <ServerContext.Provider
      value={{ ...state, servers: state.servers, setServers, activateServer, addServer }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const withServer = (Component) => {
  return function WrappedComponent(props) {
    const { servers, setServers, activateServer, addServer } = useServer();
    return (
      <Component
        {...props}
        servers={servers}
        addServer={addServer}
        setServers={setServers}
        activateServer={activateServer}
      />
    );
  };
};

export default ServerProvider;

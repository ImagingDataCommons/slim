import React, { useContext } from "react";

const AppContext = React.createContext({});

export const useApp = () => useContext(AppContext);

const AppProvider = ({ children, config, version }) => {
  const info = {
    name: "Slide Microscopy Viewer",
    version,
    uid: "1.2.826.0.1.3680043.9.7433.1.5",
  };

  return (
    <AppContext.Provider value={{ config, info }}>
      {children}
    </AppContext.Provider>
  );
};

export const withApp = (Component) => {
  return function WrappedComponent(props) {
    const app = useApp();
    return <Component {...props} app={app} />;
  };
};

export default AppProvider;

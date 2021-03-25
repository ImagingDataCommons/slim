import React, { useContext } from "react";

const AppContext = React.createContext({});

export const useAppContext = () => useContext(AppContext);

const AppProvider = ({ children, config }) => {
  return (
    <AppContext.Provider value={{ appConfig: config }}>
      {children}
    </AppContext.Provider>
  );
};

export default AppProvider;

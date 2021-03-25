import React, { useContext, createContext, useEffect } from "react";

import AuthManager from "../managers/AuthManager";
import { useAppContext } from "./AppProvider";

const AuthContext = createContext({
  signinRedirectCallback: () => ({}),
  logout: () => ({}),
  signoutRedirectCallback: () => ({}),
  isAuthenticated: () => ({}),
  signinRedirect: () => ({}),
  signinSilentCallback: () => ({}),
  createSigninRequest: () => ({}),
});

export const AuthConsumer = AuthContext.Consumer;

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const { appConfig } = useAppContext();

  const authManager = new AuthManager({ appConfig });

  return (
    <AuthContext.Provider value={authManager}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
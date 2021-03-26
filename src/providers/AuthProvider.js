import React, { Component, useContext, createContext, useState, useEffect } from "react";

import AuthManager from "../managers/AuthManager";
import { useAppContext } from "./AppProvider";

const AuthContext = createContext({
  completeLogin: () => ({}),
  completeLogout: () => ({}),
  silentLogin: () => ({}),
  completeSilentLogin: () => ({}),
  login: () => ({}),
  logout: () => ({}),
  isLoggedIn: () => ({}),
  loadUser: () => ({}),
});

export const AuthConsumer = AuthContext.Consumer;

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const { appConfig } = useAppContext();
  const authManager = new AuthManager({ appConfig });

  useEffect(() => {
    authManager.loadUser();
  }, []);

  return (
    <AuthContext.Provider value={authManager}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
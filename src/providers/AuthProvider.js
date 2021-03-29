import React, { useContext, useEffect, useState } from "react";
import {
  AuthContext as OIDCAuthContext,
  AuthProvider as OIDCAuthProvider,
} from "oidc-react";

const AuthContext = React.createContext({});

export const useAuth = () => useContext(AuthContext);

/**
 * Extract and maps OIDC user data to internal user representation
 *
 * @param {object} oidcProviderData OIDC provider data
 * @param {object} oidcProviderData.userData OIDC user data
 * @param {object} oidcProviderData.userData.profile OIDC user profile
 * @returns {object} internal user representation
 */
const OIDCUserToSLIMUser = ({ userData }) => {
  const { profile } = userData;
  return {
    username: profile.nickname,
    email: profile.email,
    name: profile.name,
    getAccessToken: () => userData.access_token,
  };
};

/**
 * Provider to consistently share auth
 * related data throughout the application
 *
 * @param {object} props Auth provider props
 * @param {object} props.children Auth provider children components
 * @param {object} props.oidc OIDC provider data
 * @returns {*} Auth provider
 */
const AuthProvider = ({ children, oidc }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (oidc && oidc.userData) {
      const user = OIDCUserToSLIMUser(oidc);
      setUser(user);
    }
  }, [oidc]);

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
};

/**
 * A public higher-order component to access the imperative API
 *
 * @param {function} Component React component
 * @returns {function} React component
 */
export const withAuth = (Component) => {
  return function WrappedComponent(props) {
    const { user } = useAuth();
    return <Component {...props} user={user} />;
  };
};

/**
 * Allows us to compose multiple auth providers from different
 * identity providers and unify them through the same AuthProvider interface
 *
 * @param {object} props Auth provider props
 * @param {object?} props.children Auth provider children components
 * @param {object} props.oidc OIDC configuration
 * @returns {*} Auth provider
 */
const ComposedAuthProvider = ({ children, oidc }) => {
  return (
    <OIDCAuthProvider {...oidc}>
      <OIDCAuthContext.Consumer>
        {(oidc) => {
          return <AuthProvider oidc={oidc}>{children}</AuthProvider>;
        }}
      </OIDCAuthContext.Consumer>
    </OIDCAuthProvider>
  );
};

export default ComposedAuthProvider;

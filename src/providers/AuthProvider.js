import React, { useContext, useEffect, useState } from "react";
import {
  AuthContext as OIDCAuthContext,
  AuthProvider as OIDCAuthProvider,
} from "oidc-react";

/** Utils */
import { makeAbsoluteIfNecessary } from "../utils";

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
 * @param {object} props.appConfig Apps configuration
 * @returns {*} Auth provider
 */
const ComposedAuthProvider = ({ children, appConfig }) => {
  const google = {
    /** Required */
    authority: "https://accounts.google.com",
    clientId:
      "723928408739-k9k9r3i44j32rhu69vlnibipmmk9i57p.apps.googleusercontent.com",
    redirectUri: "/callback",
    responseType: "id_token token",
    scope:
      "email profile openid https://www.googleapis.com/auth/cloudplatformprojects.readonly https://www.googleapis.com/auth/cloud-healthcare", // email profile openid
    /** Optional */
    postLogoutRedirectUri: "/logout-redirect",
    revokeUri: "https://accounts.google.com/o/oauth2/revoke?token=",
    automaticSilentRenew: true,
    revokeAccessTokenOnSignout: true,
    filterProtocolClaims: true,
  };

  const { protocol, host } = window.location;
  const baseUri = `${protocol}//${host}${appConfig.routerBasename}`;

  if (google.redirectUri) {
    google.redirectUri = makeAbsoluteIfNecessary(google.redirectUri, baseUri);
  }

  if (google.postLogoutRedirectUri) {
    google.postLogoutRedirectUri = makeAbsoluteIfNecessary(
      google.postLogoutRedirectUri,
      baseUri
    );
  }

  const onSignIn = async (user) => {
    /** TODO: Improve redirect logic */
    window.location.href = appConfig.routerBasename;
  };

  return (
    <OIDCAuthProvider {...google} onSignIn={onSignIn}>
      <OIDCAuthContext.Consumer>
        {(oidc) => {
          return <AuthProvider oidc={oidc}>{children}</AuthProvider>;
        }}
      </OIDCAuthContext.Consumer>
    </OIDCAuthProvider>
  );
};

export default ComposedAuthProvider;

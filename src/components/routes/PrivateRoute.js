import React from "react";
import { Route } from "react-router-dom";
import { useAuth } from "oidc-react";

import { AuthConsumer } from "../../providers/AuthProvider";
import { useAppContext } from "../../providers/AppProvider";

const PrivateRoute = ({ component, ...rest }) => {
  // const { appConfig } = useAppContext();
  // const { oidc } = appConfig;
  const auth = useAuth();

  // const renderFn = (Component) => (props) => {

  // return (
  //   <AuthConsumer>
  //     {({ isLoggedIn, login }) => {
  // if (!!Component && isLoggedIn()) {
  //   return <Component {...props} />;
  // }

  if (auth && auth.userData) {
    return <Route {...rest} component={component} />;
  }

  return <div>Loading...</div>;

  // for standalone
  // const queryParams = new URLSearchParams(props.location.search);
  // const iss = queryParams.get("iss");
  // const loginHint = queryParams.get("login_hint");
  // const targetLinkUri = queryParams.get("target_link_uri");

  // const oidcAuthority = oidc !== null && oidc[0].authority;
  // if (iss !== oidcAuthority) {
  //   console.error("iss of /login does not match the oidc authority");
  //   return null;
  // }

  // if (targetLinkUri !== null) {
  //   const redirectTo = { pathname: new URL(targetLinkUri).pathname };
  //   sessionStorage.setItem(
  //     "slim-redirect-to",
  //     JSON.stringify(redirectTo)
  //   );
  // } else {
  //   const redirectTo = { pathname: "/" };
  //   sessionStorage.setItem(
  //     "slim-redirect-to",
  //     JSON.stringify(redirectTo)
  //   );
  // }

  // if (loginHint !== null) {
  //   login({ login_hint: loginHint });
  // } else {
  //   login();
  // }

  //  login();

  //   return <span>Loading...</span>;
  //   //   }}
  //   // </AuthConsumer>
  //   // );
  // };

  // return <Route {...rest} render={renderFn(component)} />;
};

export default PrivateRoute;

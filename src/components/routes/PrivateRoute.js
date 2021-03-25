import React from "react";
import { Route } from "react-router-dom";

import { AuthConsumer } from "../../providers/AuthProvider";
import { useAppContext } from '../../providers/AppProvider';

const PrivateRoute = ({ component, ...rest }) => {
  const { oidc } = useAppContext();

  const renderFn = (Component) => (props) => (
    <AuthConsumer>
      {({ isAuthenticated, signinRedirect }) => {
        if (!!Component && isAuthenticated()) {
          return <Component {...props} />;
        } else {

          // const queryParams = new URLSearchParams(props.location.search);
          // const iss = queryParams.get('iss');
          // const loginHint = queryParams.get('login_hint');
          // const targetLinkUri = queryParams.get('target_link_uri');
          // debugger

          // const oidcAuthority = oidc !== null && oidc[0].authority;

          // if (iss !== oidcAuthority) {
          //   console.error(
          //     'iss of /login does not match the oidc authority'
          //   );
          //   return null;
          // }

          // userManager.removeUser().then(() => {
          //   if (targetLinkUri !== null) {
          //     const ohifRedirectTo = {
          //       pathname: new URL(targetLinkUri).pathname,
          //     };
          //     sessionStorage.setItem(
          //       'ohif-redirect-to',
          //       JSON.stringify(ohifRedirectTo)
          //     );
          //   } else {
          //     const ohifRedirectTo = {
          //       pathname: '/',
          //     };
          //     sessionStorage.setItem(
          //       'ohif-redirect-to',
          //       JSON.stringify(ohifRedirectTo)
          //     );
          //   }

          //   if (loginHint !== null) {
          //     userManager.signinRedirect({ login_hint: loginHint });
          //   } else {
          //     userManager.signinRedirect();
          //   }

          signinRedirect();
          return <span>Loading...</span>;


        }
      }}
    </AuthConsumer>
  );

  return <Route {...rest} render={renderFn(component)} />;
};

export default PrivateRoute;

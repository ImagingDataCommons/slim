import React from "react";
import { Route } from "react-router-dom";
import { useAuth } from "oidc-react";

const PrivateRoute = ({ component, ...rest }) => {
  const auth = useAuth();

  if (auth && auth.userData) {
    return <Route {...rest} component={component} />;
  }

  return <div>Loading...</div>;
};

export default PrivateRoute;

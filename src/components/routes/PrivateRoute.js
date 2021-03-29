import React from "react";
import { Route } from "react-router-dom";

/** Providers */
import { useAuth } from "../../providers/AuthProvider";

const PrivateRoute = ({ component, ...rest }) => {
  const auth = useAuth();

  if (auth && auth.user) {
    return <Route {...rest} component={component} />;
  }

  return <div>Loading...</div>;
};

export default PrivateRoute;

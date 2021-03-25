import React from "react";

import { AuthConsumer } from "../../providers/AuthProvider";

const LogoutCallback = () => (
  <AuthConsumer>
    {({ signoutRedirectCallback }) => {
      signoutRedirectCallback();
      return <span>Loading...</span>;
    }}
  </AuthConsumer>
);

export default LogoutCallback;

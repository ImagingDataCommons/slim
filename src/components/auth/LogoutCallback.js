import React from "react";

import { AuthConsumer } from "../../providers/AuthProvider";

const LogoutCallback = () => (
  <AuthConsumer>
    {({ completeLogout }) => {
      completeLogout();
      return <span>Loading...</span>;
    }}
  </AuthConsumer>
);

export default LogoutCallback;

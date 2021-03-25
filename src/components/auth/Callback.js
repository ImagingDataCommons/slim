import React from "react";

import { AuthConsumer } from "../../providers/AuthProvider";

const Callback = () => (
  <AuthConsumer>
    {({ signinRedirectCallback }) => {
      signinRedirectCallback();
      return <span>Loading...</span>;
    }}
  </AuthConsumer>
);

export default Callback;

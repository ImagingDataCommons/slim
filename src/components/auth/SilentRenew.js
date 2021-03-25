import React from "react";

import { AuthConsumer } from "../../providers/AuthProvider";

const SilentRenew = () => (
  <AuthConsumer>
    {({ signinSilentCallback }) => {
      signinSilentCallback();
      return <span>Loading...</span>;
    }}
  </AuthConsumer>
);

export default SilentRenew;

import React from "react";

import { AuthConsumer } from "../../providers/AuthProvider";

const SilentRenew = () => (
  <AuthConsumer>
    {({ completeSilentLogin }) => {
      completeSilentLogin();
      return <span>Loading...</span>;
    }}
  </AuthConsumer>
);

export default SilentRenew;

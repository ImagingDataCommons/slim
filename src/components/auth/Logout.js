import React from "react";

import { AuthConsumer } from "../../providers/AuthProvider";

const Logout = () => (
  <AuthConsumer>
    {({ logout }) => {
      logout();
      return <span>...Loading</span>;
    }}
  </AuthConsumer>
);

export default Logout;

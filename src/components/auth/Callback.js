import React from "react";

import { AuthConsumer } from "../../providers/AuthProvider";

const Callback = ({ history }) => (
  <AuthConsumer>
    {({ completeLogin }) => {
      completeLogin();
      // for standalone 
      // completeLogin().then(() => {
      //   const { pathname, search = "" } = JSON.parse(
      //     sessionStorage.getItem("slim-redirect-to")
      //   );
      //   history.push({ pathname, search });
      // });
      return <span>Redirecting...</span>;
    }}
  </AuthConsumer>
);

export default Callback;

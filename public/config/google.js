window.config = {
  routerBasename: "/",
  enableGoogleCloudAdapter: true,
  healthcareApiEndpoint: "https://healthcare.googleapis.com/v1",
  servers: {
    /** This is an array, but we'll only use the first entry for now */
    dicomWeb: [],
  },
  /** This is an array, but we'll only use the first entry for now */
  oidc: [
    {
      /** Required */
      authority: "https://accounts.google.com",
      client_id:
        "765360741916-s7bs8f9peg2mk5hs4cv444ljua4e72si.apps.googleusercontent.com",
      redirect_uri: "/callback",
      silent_redirect_uri: "/silent-renew",
      response_type: "id_token token",
      scope:
        "email profile openid https://www.googleapis.com/auth/cloudplatformprojects.readonly https://www.googleapis.com/auth/cloud-healthcare", // email profile openid
      /** Optional */
      post_logout_redirect_uri: "/logout-redirect",
      revoke_uri: "https://accounts.google.com/o/oauth2/revoke?token=",
      automaticSilentRenew: true,
      revokeAccessTokenOnSignout: true,
      filterProtocolClaims: true /** Took from OHIF */,
    },
  ],
  studyListFunctionsEnabled: true,
};

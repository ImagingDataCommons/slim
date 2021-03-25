import { UserManager, WebStorageStateStore, Log } from "oidc-client";

import { makeAbsoluteIfNecessary } from "../utils";

export default class AuthManager {
  UserManager;

  constructor({ appConfig }) {
    const { oidc, routerBasename } = appConfig;
    const oidcConfig = oidc !== null && oidc[0];

    const { protocol, host } = window.location;
    const baseUri = `${protocol}//${host}${routerBasename}`;

    if (oidcConfig.redirect_uri) {
      oidcConfig.redirect_uri = makeAbsoluteIfNecessary(
        oidcConfig.redirect_uri,
        baseUri
      );
    }

    if (oidcConfig.post_logout_redirect_uri) {
      oidcConfig.post_logout_redirect_uri = makeAbsoluteIfNecessary(
        oidcConfig.post_logout_redirect_uri,
        baseUri
      );
    }

    if (oidcConfig.silent_redirect_uri) {
      oidcConfig.silent_redirect_uri = makeAbsoluteIfNecessary(
        oidcConfig.silent_redirect_uri,
        baseUri
      );
    }

    this.UserManager = new UserManager({
      ...oidcConfig,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      // metadata: {
      //   ...your metadata here
      // },
    });

    Log.logger = console;
    Log.level = Log.DEBUG;

    this.UserManager.events.addUserLoaded((user) => {
      if (window.location.href.indexOf("signin-oidc") !== -1) {
        this.navigateToScreen();
      }
    });

    this.UserManager.events.addSilentRenewError((e) => {
      console.log("silent renew error", e.message);
    });

    this.UserManager.events.addAccessTokenExpired(() => {
      console.log("token expired");
      this.signinSilent();
    });
  }

  signinRedirectCallback = () => {
    this.UserManager.signinRedirectCallback().then(() => {
      "";
    });
  };

  getUser = async () => {
    const user = await this.UserManager.getUser();

    if (!user) {
      return await this.UserManager.signinRedirectCallback();
    }

    return user;
  };

  parseJwt = (token) => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace("-", "+").replace("_", "/");
    return JSON.parse(window.atob(base64));
  };

  signinRedirect = () => {
    localStorage.setItem("redirectUri", window.location.pathname);
    this.UserManager.signinRedirect({});
  };

  navigateToScreen = () => {
    window.location.replace("/en/dashboard");
  };

  isAuthenticated = () => {
    const oidcStorage = JSON.parse(
      sessionStorage.getItem(
        `oidc.user:${process.env.REACT_APP_AUTH_URL}:${process.env.REACT_APP_IDENTITY_CLIENT_ID}`
      )
    );

    return !!oidcStorage && !!oidcStorage.access_token;
  };

  signinSilent = () => {
    this.UserManager.signinSilent()
      .then((user) => {
        console.log("signed in", user);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  signinSilentCallback = () => {
    this.UserManager.signinSilentCallback();
  };

  createSigninRequest = () => {
    return this.UserManager.createSigninRequest();
  };

  logout = () => {
    this.UserManager.signoutRedirect({
      id_token_hint: localStorage.getItem("id_token"),
    });
    this.UserManager.clearStaleState();
  };

  signoutRedirectCallback = () => {
    this.UserManager.signoutRedirectCallback().then(() => {
      localStorage.clear();
      window.location.replace(process.env.REACT_APP_PUBLIC_URL);
    });
    this.UserManager.clearStaleState();
  };
}

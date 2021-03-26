import { UserManager, WebStorageStateStore, Log } from "oidc-client";

import { makeAbsoluteIfNecessary } from "../utils";

export default class AuthManager {
  user;
  userManager;

  constructor({ appConfig }) {
    debugger;
    this.appConfig = appConfig;

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

    this.userManager = new UserManager({
      ...oidcConfig,
      // userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    });

    Log.logger = console;
    Log.level = Log.DEBUG;

    this.userManager.events.addUserLoaded((user) => {
      if (window.location.href.indexOf("callback") !== -1) {
        this.navigateToScreen();
      }
    });

    this.userManager.events.addSilentRenewError((event) => {
      console.log("silent renew error", event.message);
    });

    this.userManager.events.addAccessTokenExpired(() => {
      console.log("token expired");
      this.silentLogin();
    });
  }

  loadUser() {
    this.userManager.getUser().then((user) => (this.user = user));
  }

  navigateToScreen = () => {
    window.location.replace(this.appConfig.routerBasename || "/");
  };

  completeLogin = () => {
    debugger;
    return this.userManager
      .signinRedirectCallback()
      .then((user) => (this.user = user));
  };

  loadUser() {
    this.userManager.getUser().then((user) => (this.user = user));
  }

  getUser = async () => {
    const user = await this.userManager.getUser();

    if (!user) {
      return await this.userManager.signinRedirectCallback();
    }

    return user;
  };

  login = ({ login_hint } = {}) => {
    this.userManager.signinRedirect({ login_hint });
  };

  isLoggedIn = () => {
    return this.user && this.user.access_token;
  };

  silentLogin = () => {
    this.userManager.signinSilent().then((user) => {
      this.user = user;
      console.log("signed in", user);
    });
  };

  completeSilentLogin = () => {
    this.userManager.signinSilentCallback();
  };

  logout = () => {
    this.userManager.signoutRedirect();
  };

  completeLogout = () => {
    this.userManager.signoutRedirectCallback().then(() => {
      this.userManager.removeUser();
      this.user = null;
    });
  };
}

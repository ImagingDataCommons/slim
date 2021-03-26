import React from "react";
import { BrowserRouter, Switch, RouteComponentProps } from "react-router-dom";
import * as dwc from "dicomweb-client";
import { Layout } from "antd";
import { AuthProvider } from "oidc-react";

/** Providers */
import AppProvider from "./providers/AppProvider";

/** Components */
import PrivateRoute from "./components/routes/PrivateRoute";
import Header from "./components/Header";
import Viewer from "./components/Viewer";
import Worklist from "./components/Worklist";

import { makeAbsoluteIfNecessary } from "./utils";

/** Styles */
import "antd/dist/antd.less";
import "./App.less";

import { version } from "../package.json";

interface AppProps {
  dicomwebUrl?: string;
  dicomwebPath?: string;
  qidoPathPrefix?: string;
  wadoPathPrefix?: string;
}

interface AppState {
  client: dwc.api.DICOMwebClient;
  user?: {
    name: string;
    username: string;
    email: string;
  };
}

/** React component for the main viewer application. */
class App extends React.Component<AppProps, AppState> {
  private readonly clientConfig: dwc.api.DICOMwebClientOptions;

  private readonly tokenRefresher?: NodeJS.Timeout;

  constructor(props: AppProps) {
    super(props);

    if (props.dicomwebUrl !== undefined) {
      this.clientConfig = {
        url: props.dicomwebUrl,
        headers: {},
      };
    } else if (props.dicomwebPath !== undefined) {
      this.clientConfig = {
        url: `${window.location.origin}${props.dicomwebPath}`,
        headers: {},
      };
    } else {
      throw new Error("Either DICOMweb path or full URL needs to be provided.");
    }

    if (props.qidoPathPrefix !== undefined) {
      this.clientConfig.qidoUrlPrefix = props.qidoPathPrefix;
    }

    if (props.wadoPathPrefix !== undefined) {
      this.clientConfig.wadoUrlPrefix = props.wadoPathPrefix;
    }

    this.state = {
      /** Sets token headers on login like ohif */
      client: new dwc.api.DICOMwebClient(this.clientConfig),
    };
  }

  componentWillUnmount(): void {
    clearInterval(Number(this.tokenRefresher));
  }

  render(): React.ReactNode {
    if (this.state.client === undefined) {
      return null;
    }

    const appInfo = {
      name: "Slide Microscopy Viewer",
      version: version,
      uid: "1.2.826.0.1.3680043.9.7433.1.5",
    };

    const ExtendedWorklist = (props: any) => {
      return <Worklist client={this.state.client} {...props} />;
    };

    const ExtendedViewer = (match: RouteComponentProps) => {
      const path = match.location.pathname;
      const studyInstanceUID = path.split("/")[2];
      return (
        <>
          <Viewer
            client={this.state.client}
            user={this.state.user}
            app={appInfo}
            studyInstanceUID={studyInstanceUID}
          />
        </>
      );
    };

    /** TODO: Move to public folder */
    const HARDCODED_CONFIG = {
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
            "723928408739-k9k9r3i44j32rhu69vlnibipmmk9i57p.apps.googleusercontent.com",
          redirect_uri: "/callback",
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

    const google = {
      onSignIn: async (user: any) => {
        alert("You just signed in, congratz! Check out the console!");
        console.log(user);
        window.location.href = "/";
      },
      /** Required */
      authority: "https://accounts.google.com",
      clientId:
        "723928408739-k9k9r3i44j32rhu69vlnibipmmk9i57p.apps.googleusercontent.com",
      redirectUri: "/callback",
      responseType: "id_token token",
      scope:
        "email profile openid https://www.googleapis.com/auth/cloudplatformprojects.readonly https://www.googleapis.com/auth/cloud-healthcare", // email profile openid
      /** Optional */
      postLogoutRedirectUri: "/logout-redirect",
      revokeUri: "https://accounts.google.com/o/oauth2/revoke?token=",
      automaticSilentRenew: true,
      revokeAccessTokenOnSignout: true,
      filterProtocolClaims: true /** Took from OHIF */,
    };

    const { routerBasename } = HARDCODED_CONFIG;
    const { protocol, host } = window.location;
    const baseUri = `${protocol}//${host}${routerBasename}`;

    if (google.redirectUri) {
      google.redirectUri = makeAbsoluteIfNecessary(google.redirectUri, baseUri);
    }

    if (google.postLogoutRedirectUri) {
      google.postLogoutRedirectUri = makeAbsoluteIfNecessary(
        google.postLogoutRedirectUri,
        baseUri
      );
    }

    return (
      <AppProvider config={HARDCODED_CONFIG}>
        <AuthProvider {...google}>
          <BrowserRouter>
            <Layout style={{ height: "100vh" }}>
              <Header app={appInfo} user={this.state.user} />
              <Layout.Content style={{ height: "100%" }}>
                <Switch>
                  <PrivateRoute exact path="/" component={ExtendedWorklist} />
                  <PrivateRoute
                    path="/studies/:StudyInstanceUID"
                    component={ExtendedViewer}
                  />
                </Switch>
              </Layout.Content>
            </Layout>
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    );
  }
}

export default App;

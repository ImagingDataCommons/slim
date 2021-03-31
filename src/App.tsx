import React from "react";
import { BrowserRouter, Switch, RouteComponentProps } from "react-router-dom";
import { Layout } from "antd";
import Modal from "react-modal";

/** Providers */
import {
  AppProvider,
  ServerProvider,
  AuthProvider,
  DataStoreProvider,
} from "./providers";

/** Hooks */
import useServerFromURL from "./hooks/useServerFromURL";

/** Utils */
import { routes as routesUtils } from "./utils";

/** Components */
import { PrivateRoute, Header, Viewer, Worklist } from "./components";

/** Styles */
import "antd/dist/antd.less";
import "./App.less";

import { version } from "../package.json";

interface AppProps {
  config?: {
    routerBasename?: string;
    oidc?: Array<any>;
    servers?: Array<any>;
  };
}

interface AppState {
  user?: {
    name: string;
    username: string;
    email: string;
  };
}

Modal.setAppElement("#root");

/** React component for the main viewer application. */
class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    console.debug("Config:", props.config);
    super(props);
  }

  render(): React.ReactNode {
    /** TODO: Move to public folder */
    const HARDCODED_CONFIG = {
      routerBasename: "/",
      enableGoogleCloudAdapter: true,
      healthcareApiEndpoint: "https://healthcare.googleapis.com/v1",
      servers: {
        /** This is an array, but we'll only use the first entry for now */
        dicomWeb: [
          {
            name: "DCM4CHEE",
            wadoUriRoot:
              "https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/wado",
            qidoRoot: "https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs",
            wadoRoot: "https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs",
            qidoSupportsIncludeField: true,
            imageRendering: "wadors",
            thumbnailRendering: "wadors",
            enableStudyLazyLoad: true,
            supportsFuzzyMatching: true,
          },
        ],
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
            "email profile openid https://www.googleapis.com/auth/cloudplatformprojects.readonly https://www.googleapis.com/auth/cloud-healthcare",
          /** Optional */
          post_logout_redirect_uri: "/logout-redirect",
          revoke_uri: "https://accounts.google.com/o/oauth2/revoke?token=",
          automaticSilentRenew: true,
          revokeAccessTokenOnSignout: true,
          filterProtocolClaims: true,
        },
      ],
      studyListFunctionsEnabled: true,
    };

    const WorklistRoute = (props: RouteComponentProps | any) => {
      const { project, location, dataset, dicomStore } = props.match.params;
      const server = useServerFromURL({
        project,
        location,
        dataset,
        dicomStore,
      });

      routesUtils.updateWorklistURL(HARDCODED_CONFIG, server, props.history);

      return <Worklist {...props} />;
    };

    const ViewerRoute = (props: RouteComponentProps | any) => {
      const {
        project,
        location,
        dataset,
        dicomStore,
        studyInstanceUID,
      } = props.match.params;
      const server = useServerFromURL({
        project,
        location,
        dataset,
        dicomStore,
      });
      return <Viewer studyInstanceUID={studyInstanceUID} />;
    };

    return (
      <AppProvider config={HARDCODED_CONFIG} version={version}>
        <AuthProvider appConfig={HARDCODED_CONFIG}>
          <ServerProvider appConfig={HARDCODED_CONFIG}>
            <DataStoreProvider>
              <BrowserRouter>
                <Layout style={{ height: "100vh" }}>
                  <Header />
                  <Layout.Content style={{ height: "100%" }}>
                    <Switch>
                      <PrivateRoute
                        exact
                        path={HARDCODED_CONFIG.routerBasename}
                        component={WorklistRoute}
                      />
                      <PrivateRoute
                        path="/studies/:studyInstanceUID"
                        component={ViewerRoute}
                      />
                      <PrivateRoute
                        exact
                        path="/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore"
                        component={WorklistRoute}
                      />
                      <PrivateRoute
                        path="/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore/study/:studyInstanceUID"
                        component={ViewerRoute}
                      />
                    </Switch>
                  </Layout.Content>
                </Layout>
              </BrowserRouter>
            </DataStoreProvider>
          </ServerProvider>
        </AuthProvider>
      </AppProvider>
    );
  }
}

export default App;

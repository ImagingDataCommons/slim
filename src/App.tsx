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

/** Components */
import {
  PrivateRoute,
  Header,
  Viewer,
  Worklist,
  DICOMStorePickerModal,
} from "./components";

/** Utils */
import { makeAbsoluteIfNecessary } from "./utils";

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
            "",
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

    const WorklistRoute = (props: any) => {
      return (
        <>
          {/* <DICOMStorePickerModal isOpen onClose={() => {}} /> */}
          <Worklist {...props} />
        </>
      );
    };

    const ViewerRoute = (match: RouteComponentProps) => {
      const path = match.location.pathname;
      const studyInstanceUID = path.split("/")[2];
      return (
        <>
          <Viewer studyInstanceUID={studyInstanceUID} />
        </>
      );
    };

    const google = {
      onSignIn: async (user: any) => {
        debugger;
        window.location.href = HARDCODED_CONFIG.routerBasename;
      },
      /** Required */
      authority: "https://accounts.google.com",
      clientId:
        "",
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

    const {
      routerBasename,
      servers,
      enableGoogleCloudAdapter,
    } = HARDCODED_CONFIG;
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

    // let healthCareApiButtons = null;
    // let healthCareApiWindows = null;
    // const [activeModalId, setActiveModalId] = useState(null);
    // if (enableGoogleCloudAdapter) {
    //   const isModalOpen = activeModalId === "DicomStorePicker";
    //   // updateURL(isModalOpen, appConfig, server, history);
    //   healthCareApiWindows = (
    //     <DICOMStorePicker
    //       isOpen={activeModalId === "DicomStorePicker"}
    //       onClose={() => setActiveModalId(null)}
    //     />
    //   );
    //   healthCareApiButtons = (
    //     <div
    //       className="form-inline btn-group pull-right"
    //       style={{ padding: "20px" }}
    //     >
    //       <button
    //         className="btn btn-primary"
    //         onClick={() => setActiveModalId("DicomStorePicker")}
    //       >
    //         {t("Change DICOM Store")}
    //       </button>
    //     </div>
    //   );
    // }

    return (
      <AppProvider config={HARDCODED_CONFIG} version={version}>
        <AuthProvider oidc={google}>
          <ServerProvider servers={servers}>
            <DataStoreProvider>
              <BrowserRouter>
                <Layout style={{ height: "100vh" }}>
                  <Header />
                  <Layout.Content style={{ height: "100%" }}>
                    <Switch>
                      <PrivateRoute
                        exact
                        path={routerBasename}
                        component={WorklistRoute}
                      />
                      <PrivateRoute
                        path="/studies/:StudyInstanceUID"
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

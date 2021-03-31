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
  config: {
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
    super(props);
  }

  render(): React.ReactNode {
    const WorklistRoute = (props: RouteComponentProps | any) => {
      const { project, location, dataset, dicomStore } = props.match.params;
      const server = useServerFromURL({
        project,
        location,
        dataset,
        dicomStore,
      });

      routesUtils.updateWorklistURL(this.props.config, server, props.history);

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
      useServerFromURL({
        project,
        location,
        dataset,
        dicomStore,
      });
      return <Viewer studyInstanceUID={studyInstanceUID} />;
    };

    return (
      <AppProvider config={this.props.config} version={version}>
        <AuthProvider appConfig={this.props.config}>
          <ServerProvider appConfig={this.props.config}>
            <DataStoreProvider>
              <BrowserRouter>
                <Layout style={{ height: "100vh" }}>
                  <Header />
                  <Layout.Content style={{ height: "100%" }}>
                    <Switch>
                      <PrivateRoute
                        exact
                        path={this.props.config.routerBasename}
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

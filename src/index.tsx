import React from "react";
import ReactDOM from "react-dom";

import "./index.css";
import App from "./App";

import { version } from "../package.json";

declare global {
  interface Window {
    config: any;
    version: any;
  }
}

/*
 * Default Settings
 */
let config = {};

if (window) {
  config = window.config || {};
  window.version = version;
}

ReactDOM.render(
  <React.StrictMode>
    <App config={config} />
  </React.StrictMode>,
  document.getElementById("root")
);

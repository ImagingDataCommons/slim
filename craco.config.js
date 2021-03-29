const path = require("path");
const CracoLessPlugin = require("craco-less");
const CopyWebpackPlugin = require("copy-webpack-plugin");

/** Environment Variables */
const APP_CONFIG = process.env.APP_CONFIG || "config/default.js";
const PUBLIC_DIR = path.join(__dirname, "./public");
const DIST_DIR = path.join(__dirname, "./build");

module.exports = {
  plugins: [
    {
      plugin: CopyWebpackPlugin,
      options: {
        /** Copy over and rename our target app config file */
        patterns: [
          {
            from: `${PUBLIC_DIR}/${APP_CONFIG}`,
            to: `${DIST_DIR}/app-config.js`,
          },
        ],
      },
    },
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              "@layout-header-background": "#007ea3",
              "@primary-color": "#007ea3",
              "@processing-color": "#8cb8c6",
              "@success-color": "#3f9c35",
              "@warning-color": "#eeaf30",
              "@error-color": "#96172e",
              "@font-size-base": "14px",
            },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
};

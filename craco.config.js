const CracoLessPlugin = require('craco-less')

module.exports = {
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              '@layout-header-background': '#007ea3',
              '@primary-color': '#007ea3',
              '@processing-color': '#8cb8c6',
              '@success-color': '#3f9c35',
              '@warning-color': '#eeaf30',
              '@error-color': '#96172e',
              '@font-size-base': '14px',
            },
            javascriptEnabled: true
          }
        }
      }
    }
  ]
}

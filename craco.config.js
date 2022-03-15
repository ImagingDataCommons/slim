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
              '@font-size-base': '14px'
            },
            javascriptEnabled: true
          }
        }
      }
    }
  ],
  webpack: {
    configure: (config, { env, paths }) => {
      config.resolve = {
        fallback: {
          fs: false,
          path: false
        },
        extensions: ['.tsx', '.ts', '.js', '.wasm', '.json']
      }
      config.target = 'web'
      config.experiments = {
        asyncWebAssembly: true
      }
      return config
    }
  },
  jest: {
    configure: (config, { env, paths }) => {
      config.transform = {
        '^.+wasm.*\\.js$': '<rootDir>/src/__mocks__/emscriptenMock.js',
        '\\.(wasm)$': '<rootDir>/src/__mocks__/wasmMock.js',
        '\\.(css|less|sass|scss)$': '<rootDir>/src/__mocks__/styleMock.js',
        '^.+\\.[t|j]sx?$': 'babel-jest'
      }
      config.transformIgnorePatterns = [
        'node_modules/(?!(ol|dicom-microscopy-viewer|dicomweb-client|@cornerstonejs|dicomicc)/)'
      ]
      return config
    }
  }
}

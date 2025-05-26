const CracoLessPlugin = require('craco-less')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack')

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
        extensions: ['.tsx', '.ts', '.js', '.wasm', '.json'],
        /* We use this alias and the CopyPlugin below to support using the
         * dynamic-import version of Dicom Microscopy Viewer, but only when
         * building a PWA. When we build a package, we must use the bundled
         * version of Dicom Microscopy Viewer so we can produce a single file
         * for the viewer.
        */
        alias: {
          'dicom-microscopy-viewer':
            'dicom-microscopy-viewer/dist/dynamic-import/dicom-microscopy-viewer/dicomMicroscopyViewer.min.js'
        }
      }
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: './node_modules/dicom-microscopy-viewer/dist/dynamic-import/dicom-microscopy-viewer',
              to: './static/js'
            }
          ]
        })
      )

      // Rewrite dicom-microscopy-viewer URLs to correct path
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.compilation.tap('RewriteUrlsPlugin', (compilation) => {
            compilation.hooks.processAssets.tap(
              { name: 'RewriteUrlsPlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE },
              (assets) => {
                for (const [filename, asset] of Object.entries(assets)) {
                  if (typeof asset.source() === 'string') {
                    compilation.updateAsset(
                      filename,
                      new webpack.sources.RawSource(asset.source().replace(/\/dicom-microscopy-viewer\//g, '/static/js/'))
                    );
                  }
                }
              }
            );
          });
        }
      });

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
        'node_modules/(?!(ol|dicom-microscopy-viewer|dicomweb-client|@cornerstonejs|dicomicc|rbush|color-rgba|color-parse|color-name|color-space|quickselect|earcut)/)'
      ]
      config.moduleNameMapper = {
        '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs': '@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm_decode',
        '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasm': '@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm_decode.wasm',
        '@cornerstonejs/codec-charls/decodewasmjs': '@cornerstonejs/codec-charls/dist/charlswasm_decode.js',
        '@cornerstonejs/codec-charls/decodewasm': '@cornerstonejs/codec-charls/dist/charlswasm_decode.wasm',
        '@cornerstonejs/codec-openjpeg/decodewasmjs': '@cornerstonejs/codec-openjpeg/dist/openjpegwasm_decode.js',
        '@cornerstonejs/codec-openjpeg/decodewasm': '@cornerstonejs/codec-openjpeg/dist/openjpegwasm_decode.wasm'
      }
      return config
    }
  }
}

const fs = require('fs')
const path = require('path')
const CracoLessPlugin = require('craco-less')
const CopyWebpackPlugin = require('copy-webpack-plugin')

/**
 * When dicom-microscopy-viewer is pnpm-linked, resolve the real repo path so
 * webpack can watch DMV dist/ rebuilds. The import alias must stay under
 * node_modules (CRA ModuleScopePlugin blocks absolute paths outside src/).
 */
function getLinkedDmvPaths() {
  const dmvEntry = path.resolve(
    __dirname,
    'node_modules/dicom-microscopy-viewer',
  )
  let dmvRoot
  try {
    dmvRoot = fs.realpathSync(dmvEntry)
  } catch {
    return null
  }

  const isLinked = !dmvRoot.includes(`${path.sep}.pnpm${path.sep}`)
  if (!isLinked) {
    return null
  }

  const dmvDist = path.join(dmvRoot, 'dist/dynamic-import')
  const dmvBundle = path.join(dmvDist, 'dicomMicroscopyViewer.min.js')
  return { dmvRoot, dmvDist, dmvBundle }
}

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
              '@collapse-header-bg': '#e0f2f7',
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
      const linkedDmv =
        env === 'development' ? getLinkedDmvPaths() : null
      const dmvDist =
        './node_modules/dicom-microscopy-viewer/dist/dynamic-import'
      const dmvAlias =
        'dicom-microscopy-viewer/dist/dynamic-import/dicomMicroscopyViewer.min.js'

      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
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
          ...config.resolve?.alias,
          'dicom-microscopy-viewer': dmvAlias
        }
      }
      config.plugins.push(
        // TO DO: remove hard coded path
        new CopyWebpackPlugin({
          patterns: [
            {
              from: dmvDist,
              to: './static/js'
            }
          ]
        })
      )
      config.target = 'web'
      config.experiments = {
        asyncWebAssembly: true
      }

      if (linkedDmv) {
        config.watchOptions = {
          ...config.watchOptions,
          followSymlinks: true,
        }

        config.snapshot = {
          ...config.snapshot,
          managedPaths: [
            /^(.+?[\\/]node_modules[\\/])(?!dicom-microscopy-viewer)/,
          ],
        }

        config.plugins.push({
          apply: (compiler) => {
            compiler.hooks.afterCompile.tap('WatchLinkedDmvDist', (compilation) => {
              compilation.contextDependencies.add(linkedDmv.dmvDist)
              compilation.fileDependencies.add(linkedDmv.dmvBundle)
            })
          },
        })

        config.devServer = {
          ...config.devServer,
          watchFiles: {
            paths: [`${linkedDmv.dmvDist}/**/*`],
            options: {
              followSymlinks: true,
            },
          },
        }
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
        'dicom-microscopy-viewer': '<rootDir>/src/__mocks__/dicomMicroscopyViewerMock.js',
        '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs': '@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm_decode',
        '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasm': '@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm_decode.wasm',
        '@cornerstonejs/codec-charls/decodewasmjs': '@cornerstonejs/codec-charls/dist/charlswasm_decode.js',
        '@cornerstonejs/codec-charls/decodewasm': '@cornerstonejs/codec-charls/dist/charlswasm_decode.wasm',
        '@cornerstonejs/codec-openjpeg/decodewasmjs': '@cornerstonejs/codec-openjpeg/dist/openjpegwasm_decode.js',
        '@cornerstonejs/codec-openjpeg/decodewasm': '@cornerstonejs/codec-openjpeg/dist/openjpegwasm_decode.wasm'
      }
      config.setupFilesAfterEnv = ['<rootDir>/src/setupTests.tsx']
      config.testEnvironment = 'jsdom'
      return config
    }
  }
}

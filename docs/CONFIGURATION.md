# Slim configuration guide

Single-page documentation for the most important Slim configuration options.
The app is configured via a JavaScript file under `public/config/` (for example
`public/config/local.js`). Select the file at build time with the
`REACT_APP_CONFIG` environment variable.

For the full type definitions, see [`src/AppConfig.d.ts`](../src/AppConfig.d.ts).
Example configs live in [`public/config/`](../public/config/).

## Table of contents

- [External DICOMweb server](#external-dicomweb-server)
- [Runtime server selection (header button)](#runtime-server-selection-header-button)
- [Secondary GCP data source (`gcp` query parameter)](#secondary-gcp-data-source-gcp-query-parameter)
- [Annotation colors](#annotation-colors)
- [Read-only mode and worklist](#read-only-mode-and-worklist)
- [Local deployment tips](#local-deployment-tips)
- [Related documentation](#related-documentation)

## External DICOMweb server

Point Slim at any DICOMweb-conformant archive by setting `servers` in the config
file:

```js
window.config = {
  path: '/',
  servers: [
    {
      id: 'local',
      url: 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs',
      write: true,
    },
  ],
}
```

Notes:

- `url` must be the DICOMweb root (QIDO-RS / WADO-RS / STOW-RS base), not a
  study or series URL.
- `write: true` enables storing annotations back to that server.
- Optional path prefixes (`qidoPathPrefix`, `wadoPathPrefix`, `stowPathPrefix`)
  and `upgradeInsecureRequests` are documented in the
  [README](../README.md#handling-mixed-content-and-https).
- For Google Cloud Healthcare, see the
  [GCP deployment section](../README.md#google-cloud-platform) in the README
  (includes OIDC settings).

## Runtime server selection (header button)

Slim can let users change the active DICOMweb endpoint at runtime without
rebuilding the app. This is the feature described in
[issue #5](https://github.com/ImagingDataCommons/slim/issues/5)
(“configurable servers” / external server via the UI).

### Enable the header button

Set `enableServerSelection` to `true` in the config:

```js
window.config = {
  path: '/',
  servers: [
    {
      id: 'default',
      url: 'https://example.com/dicomweb',
      write: false,
    },
  ],
  enableServerSelection: true,
}
```

When enabled, an **API / server** button appears in the header (Ant Design
`ApiOutlined` icon; often referred to as the “link” icon in discussions).
Clicking it opens the **Select DICOMweb server** dialog.

Reference configs that already enable this:

- [`public/config/example.js`](../public/config/example.js)
- [`public/config/wg26.js`](../public/config/wg26.js)

### Using the dialog

1. Choose **Use default server** to restore the server from the config file, or
   **Use custom server** to enter another endpoint.
2. For a custom server, paste either:
   - a **full DICOMweb URL**, e.g.
     `https://healthcare.googleapis.com/v1/projects/.../dicomStores/.../dicomWeb`
   - a **GCP Healthcare path** without the domain, e.g.
     `/projects/my-project/locations/us-central1/datasets/my-dataset/dicomStores/my-store`
     (Slim prepends `https://healthcare.googleapis.com/v1` and appends
     `/dicomWeb`; override the base with `gcpBaseUrl` if needed)
3. Leading/trailing spaces in the URL are trimmed automatically.

The selected custom URL is stored in `localStorage` (`slim_selected_server`) so
it persists across reloads. Authorization is re-applied when switching servers.

## Secondary GCP data source (`gcp` query parameter)

You can load images from the primary configured server and pull annotations /
derived datasets from a second Google Cloud Healthcare DICOMweb store by adding
a `gcp` query parameter to the viewer URL:

```text
https://<slim-host>/studies/<StudyInstanceUID>/series/<SeriesInstanceUID>?gcp=https://healthcare.googleapis.com/v1/projects/<project>/locations/<location>/datasets/<dataset>/dicomStores/<store>/dicomWeb
```

Behavior:

- Slim registers a server with id `gcp_secondary_annotation_server`.
- That secondary server is limited to annotation / derived storage classes
  (Comprehensive SR, Segmentation, Microscopy Bulk Simple Annotations,
  Parametric Map, presentation states, etc.).
- The primary `servers` entry remains the main image data source.

Optional: set `gcpBaseUrl` when path-only GCP URLs should resolve against a
non-default API version (defaults to `https://healthcare.googleapis.com/v1`):

```js
window.config = {
  gcpBaseUrl: 'https://healthcare.googleapis.com/v1beta1',
  // ...
}
```

Commented examples appear in [`public/config/example.js`](../public/config/example.js).

> Related enhancement request for loading *all* data from both stores:
> [issue #320](https://github.com/ImagingDataCommons/slim/issues/320).

## Annotation colors

### Default color per finding (config)

Each entry in `annotations` can define a `style` used when drawing ROIs for that
finding code. Colors are RGBA arrays (`[r, g, b, a]` with channels `0–255` for
RGB and `0–1` for alpha):

```js
window.config = {
  annotations: [
    {
      finding: {
        value: '85756007',
        schemeDesignator: 'SCT',
        meaning: 'Tissue',
      },
      geometryTypes: ['polygon', 'freehandpolygon'],
      style: {
        stroke: {
          color: [255, 255, 0, 1],
          width: 2,
        },
        fill: {
          color: [255, 255, 255, 0.2],
        },
      },
    },
    {
      finding: {
        value: '108369006',
        schemeDesignator: 'SCT',
        meaning: 'Tumor',
      },
      geometryTypes: ['polygon', 'freehandpolygon'],
      style: {
        stroke: {
          color: [255, 0, 255, 1],
          width: 2,
        },
        fill: {
          color: [255, 255, 255, 0.2],
        },
      },
    },
  ],
}
```

See [`public/config/local.js`](../public/config/local.js) for a full working
example with several findings and colors.

If `style` is omitted for a finding, Slim falls back to the default ROI style
(yellow stroke) or assigns colors from an internal palette when formatting
loaded annotations.

### Changing colors in the UI

While viewing a slide, users can change the color / opacity of individual
annotations (or annotation groups) from the annotation panel. Those runtime
changes update the on-screen style for the corresponding finding key.

### Selection highlight color

The highlight style applied when an ROI is **selected** is currently fixed in
the viewer code (blue stroke `[0, 153, 255]`) and is **not** configurable via
`window.config`. Per-finding default colors above control the unselected
appearance.

## Read-only mode and worklist

### Disable annotation tools (`disableAnnotationTools`)

Set `disableAnnotationTools: true` for a read-only deployment (view images and
existing annotations, but hide creation / editing tools):

```js
window.config = {
  // ...
  disableAnnotationTools: true,
}
```

Default is `false` (tools enabled).

### Disable the worklist (`disableWorklist`)

Set `disableWorklist: true` to skip the study worklist and hide worklist
navigation. Useful when Slim is embedded with deep links to a specific study or
series:

```js
window.config = {
  // ...
  disableWorklist: true,
}
```

Default is `false` (worklist enabled).

Example combining both flags:

```js
window.config = {
  path: '/',
  servers: [{ id: 'readonly', url: 'https://example.com/dicomweb', write: false }],
  disableWorklist: true,
  disableAnnotationTools: true,
  enableServerSelection: false,
}
```

## Local deployment tips

### Docker Compose (dcm4chee)

`docker-compose up -d` serves Slim at `http://localhost:8008` and exposes
DICOMweb at:

```text
http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs
```

That URL is already set in [`public/config/local.js`](../public/config/local.js).

### Orthanc or another local archive

If you point Slim at Orthanc (or any other DICOMweb server) instead of the
compose stack, use that server’s DICOMweb root, for example:

```js
servers: [
  {
    id: 'orthanc',
    url: 'http://localhost:8042/dicom-web',
    write: true,
  },
]
```

If the browser shows a communication / search-for-studies error while `curl`
against the same URL succeeds, check:

1. **CORS** – the DICOMweb server must allow the Slim origin
   (`http://localhost:3000` in development, or `http://localhost:8008` when
   served from compose). Orthanc needs an explicit CORS configuration for
   cross-origin browser calls.
2. **Correct base URL** – use the DICOMweb root (`.../dicom-web` or
   `.../rs`), not a study page URL.
3. **Mixed content** – an HTTPS Slim deployment cannot call plain HTTP archives
   unless you terminate TLS in front of the archive or use a same-origin proxy.
4. **Auth** – secured endpoints need matching `oidc` settings in the config.

## Related documentation

- [README – Configuration](../README.md#configuration)
- [Logger configuration](./LOGGER_CONFIGURATION.md)
- [Memory monitoring](./MEMORY_MONITORING.md)
- [AppConfig type definitions](../src/AppConfig.d.ts)
- GitHub wiki mirror: https://github.com/ImagingDataCommons/slim/wiki

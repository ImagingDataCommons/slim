# Slim configuration guide

Single-page documentation for the most important Slim configuration options.
The app is configured via a JavaScript file under `public/config/` (for example
`public/config/local.js`). The file is loaded at runtime from
`public/config/{name}.js` via `public/index.html`. Select `{name}` at build /
start time with the `REACT_APP_CONFIG` environment variable (defaults to
`local`).

Copy [`.env.example`](../.env.example) to `.env` (gitignored) and adjust as
needed. Without `.env`, start/build defaults to `REACT_APP_CONFIG=local` and
`SLIM_LOCAL_DICOMWEB_URL` defaults to the docker-compose DICOMweb URL.
Committed `demo` / `preview` configs require `SLIM_DEMO_DICOMWEB_URL` /
`SLIM_PREVIEW_DICOMWEB_URL` in `.env` or as GitHub Actions secrets/variables
(see `scripts/inject-slim-env.mjs`).

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
file. Slim’s committed configs read the URL from `window.slim.env` (set via
`.env`); custom configs may still hardcode a URL:

```js
window.config = {
  path: '/',
  servers: [
    {
      id: 'local',
      url: window.slim.env.SLIM_LOCAL_DICOMWEB_URL,
      // or: url: 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs',
      write: true,
    },
  ],
}
```

Notes:

- Prefer a DICOMweb service root (QIDO-RS / WADO-RS / STOW-RS base), not a
  study or series URL. Alternatively, `servers[].path` may be a path relative
  to the Slim origin (resolved by `DicomWebManager`).
- `write: true` allows Slim’s `DicomWebManager.storeInstances` to call STOW-RS
  on that server. Today Slim stores verified Comprehensive 3D SR annotation
  reports this way. dicom-microscopy-viewer itself does not write instances.
- Optional path prefixes (`qidoPathPrefix`, `wadoPathPrefix`, `stowPathPrefix`)
  and `upgradeInsecureRequests` are documented in the
  [README](../README.md#handling-mixed-content-and-https).
- For Google Cloud Healthcare, see the
  [GCP deployment section](../README.md#google-cloud-platform) in the README
  (includes OIDC settings).

### How the access token is sent to servers

When an `oidc` block is present, Slim does **not** attach the token to every
server. Requests start anonymous and the token is sent only to servers that
actually ask for it. This is negotiated at runtime, so adding or swapping
DICOMweb endpoints needs no redeployment — which matters because two of the
three ways to introduce a server (the header's server-selection dialog and the
`?gcp=` URL parameter) never appear in this file at all.

The sequence for each server:

1. **Try anonymously.** The first request carries only safelisted headers, so
   the browser sends no `OPTIONS` preflight. An open server answers `200` and
   the exchange ends here — it never sees your token.
2. **On `401`/`403`, escalate.** The server has asked for credentials. What
   happens next depends on where the server came from:
   - **Listed in `servers` in this config file** — the operator has vouched for
     it, so Slim attaches the token and retries silently.
   - **Anywhere else** (typed into the server-selection dialog, or supplied via
     `?gcp=`) — Slim asks the user first: *"Send your access token to this
     server?"* Nothing is disclosed unless they agree.
3. **Remember the answer per origin** in `localStorage` under
   `slim_authorization_policy`. Each server is negotiated once per browser, not
   once per session; an approved origin is credentialed from its first request
   thereafter.

The consent prompt exists because escalation is triggered by the server. Without
it, any endpoint could obtain a live cloud credential simply by replying `401`
to an anonymous request — which is a realistic risk for a URL pasted into the
selector.

#### Overriding the negotiation

Set `sendAuthorization` on a server to bypass runtime detection:

```js
window.config = {
  path: '/',
  servers: [
    {
      // Sends the token from the first request; skips the anonymous attempt.
      id: 'gcp',
      url: 'https://healthcare.googleapis.com/v1/projects/.../dicomWeb',
      write: true,
      sendAuthorization: true,
    },
    {
      // Never sends the token, even if this server returns 401.
      id: 'public-proxy',
      url: 'https://example.org/dicomWeb',
      write: false,
      sendAuthorization: false,
    },
  ],
  oidc: { /* ... */ },
}
```

`sendAuthorization: true` is worth setting for a server that answers `200` with
*fewer results* rather than `401` when unauthenticated. Runtime detection cannot
tell that apart from an open server, so Slim would silently under-report studies.

Note that none of this affects whether OIDC sign-in happens. Sign-in only ever
obtains a token for DICOMweb requests — it is not required to serve or load the
Slim application itself. If no server needs a token, omit the `oidc` block.

## Runtime server selection (header button)

Slim can let users change the active DICOMweb endpoint at runtime without
rebuilding the app. This is the feature described in
[issue #5](https://github.com/ImagingDataCommons/slim/issues/5)
(“configurable servers” / external server via the UI).

### Enable the header button

Set `enableServerSelection` to `true` in the config (default is `false`):

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

When enabled, a **Select server** button appears in the header (Ant Design
`ApiOutlined` icon; often called the “link” icon in issue discussions).
Clicking it opens the **Select DICOMweb server** dialog.

Reference configs that already enable this:

- [`public/config/example.js`](../public/config/example.js)
- [`public/config/wg26.js`](../public/config/wg26.js)

### Using the dialog

1. Choose **Use default server** to restore the clients built from the config
   file (including any `?gcp=` secondary mapping), or **Use custom server** to
   enter another endpoint.
2. For a custom server, paste either:
   - a **full DICOMweb URL**, e.g.
     `https://healthcare.googleapis.com/v1/projects/.../dicomStores/.../dicomWeb`
   - a **GCP Healthcare path** without the domain, e.g.
     `/projects/my-project/locations/us-central1/datasets/my-dataset/dicomStores/my-store`
     — Slim always prepends `https://healthcare.googleapis.com/v1` and appends
     `/dicomWeb` via `normalizeServerUrl` (this path does **not** use
     `gcpBaseUrl`)
3. Leading/trailing spaces in the URL are trimmed automatically.

Persistence and behavior:

- Mode is stored in `localStorage` as `slim_server_selection_mode`
  (`default` | `custom`).
- The custom URL is stored as `slim_selected_server`.
- On a custom switch, Slim creates a temporary client with `read: true` and
  **`write: false`**, re-applies the current Bearer token when OIDC is in use,
  and maps **all** SOP-class clients to that single client (so a prior `?gcp=`
  primary/secondary split is replaced until you switch back to the default
  server).

### `gcpBaseUrl` (not used by the dialog)

`gcpBaseUrl` (default `https://healthcare.googleapis.com/v1`) is used when a
**default** server has no `storageClasses` and the browser path looks like a
GCP Healthcare study URL (`/projects/.../study/...`). It is **not** applied to
path-only URLs entered in the server-selection dialog, and it is **not**
applied to the `?gcp=` query parameter.

## Secondary GCP data source (`gcp` query parameter)

You can keep images on the primary configured server and route selected
derived SOP classes to a second Google Cloud Healthcare DICOMweb store by
adding a `gcp` query parameter:

```text
https://<slim-host>/studies/<StudyInstanceUID>/series/<SeriesInstanceUID>?gcp=https://healthcare.googleapis.com/v1/projects/<project>/locations/<location>/datasets/<dataset>/dicomStores/<store>/dicomWeb
```

Behavior:

- Slim registers a server with id `gcp_secondary_annotation_server`,
  `write: true`, and `url` taken **verbatim** from the query parameter (no
  `normalizeServerUrl`, no `gcpBaseUrl`).
- That secondary server is mapped to these storage classes for QIDO/WADO (and
  STOW when writing those classes):
  Comprehensive SR, Comprehensive 3D SR, Segmentation, Microscopy Bulk Simple
  Annotations, Parametric Map, and the listed presentation-state classes.
- The primary / default server remains the client for VL Whole Slide
  Microscopy Images.
- Saving a verified Comprehensive 3D SR annotation report uses the client
  mapped to Comprehensive 3D SR — i.e. the secondary store when `?gcp=` is
  present.

Caveat (dicom-microscopy-viewer): Slim searches/loads ANN **metadata** via the
secondary client, but dmv’s `addAnnotationGroups` currently fetches ANN
bulkdata through the VL Whole Slide Microscopy Image client mapping (typically
the primary store). Absolute `BulkDataURI` values with shared auth often still
work; relative URIs or P10 fallback may hit the wrong store. SEG and Parametric
Map loaders correctly use their SOP-class clients.

> Related enhancement request for loading *all* data from both stores:
> [issue #320](https://github.com/ImagingDataCommons/slim/issues/320).

## Annotation colors

dicom-microscopy-viewer exposes **two** style models. Slim’s config
`annotations[].style` matches the ROI / SR path.

### Default color per finding (config) — SR ROIs

Each entry in `annotations` can define a `style` used when drawing SR ROIs for
that finding code. Colors are RGBA-style arrays (`[r, g, b]` or
`[r, g, b, a]`; RGB channels `0–255`, alpha typically `0–1`). Slim maps these
into dmv `ROIStyleOptions` via `formatRoiStyle` / `setROIStyle`:

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

Styles are keyed by finding as `CodingSchemeDesignator-CodeValue` (see
`buildKey` in `src/components/SlideViewer/utils/roiUtils.ts`).

See [`public/config/local.js`](../public/config/local.js) for a full working
example with several findings and colors.

Fallbacks:

1. Finding listed in `config.annotations` **without** `style` → Slim’s default
   ROI style (yellow stroke `[255, 234, 0]`).
2. Loaded ROI whose finding is **not** in `config.annotations` → when
   formatted, Slim assigns a color from `DEFAULT_ANNOTATION_COLOR_PALETTE`.

### Microscopy Bulk Simple Annotations (ANN groups)

Bulk annotation groups use dmv’s `setAnnotationGroupStyle` /
`showAnnotationGroup` options: RGB `color` plus a separate `opacity` (not the
ROI stroke/fill schema). The annotation panel can change group color/opacity
at runtime; those edits update only that group’s on-screen style and do **not**
update Slim’s finding-key `roiStyles` map.

When config styles are applied to groups, Slim currently passes the configured
`fill.color` as the group `color` (RGB channels only); stroke color and fill
alpha are not used the same way as for SR ROIs.

### Changing SR ROI colors in the UI

For Comprehensive SR ROIs, the annotation panel can change color / opacity.
`handleRoiStyleChange` updates `roiStyles` for that finding key and calls
`setROIStyle` on the edited ROI. Other existing ROIs of the same finding may
not all restyle immediately.

### Selection / highlight colors

- **Selected SR ROI** highlight is hard-coded in Slim as stroke
  `[0, 153, 255]` (alpha 1) and is **not** configurable via `window.config`.
- **Bulk ANN hover highlight** uses dmv’s `highlightColor` (default
  `[140, 184, 198]`), which is separate from Slim’s ROI selection style.

## Read-only mode and worklist

### Disable annotation tools (`disableAnnotationTools`)

Set `disableAnnotationTools: true` to hide the slide toolbar that contains
annotation creation / editing controls (default is `false`, tools enabled):

```js
window.config = {
  // ...
  disableAnnotationTools: true,
}
```

Existing annotations remain viewable. The same flag also hides other controls
bundled in that toolbar (for example **Go to**), not only draw/edit/save.

### Disable the worklist (`disableWorklist`)

Set `disableWorklist: true` to replace the study worklist on `/` with
“Worklist has been disabled.” and to hide the worklist navigation button
(default is `false`):

```js
window.config = {
  // ...
  disableWorklist: true,
}
```

Deep links such as `/studies/...` still work; routes are not removed.

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

That URL belongs in `.env` as `SLIM_LOCAL_DICOMWEB_URL` (see `.env.example`).
`public/config/local.js` reads it from `window.slim.env`.
nginx in the compose stack proxies the dcm4chee DICOMweb paths; Orthanc is not
part of that stack.

### Orthanc or another local archive

If you point Slim at Orthanc (or any other DICOMweb server) instead of the
compose stack, use that server’s DICOMweb root. Orthanc’s DICOMweb plugin
defaults to `/dicom-web` (configurable via `DicomWeb.Root`):

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

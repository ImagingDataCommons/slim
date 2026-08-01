# End-to-end / visual-regression tests

Playwright tests that drive the real app in a real (WebGL-capable) browser and
compare the deck.gl bulk-annotation overlay against committed screenshot
baselines, so rendering regressions are caught automatically.

## What is covered

- `bulk-annotations.spec.ts`
  - A large (~396k-polygon) annotation group loads and paints without
    exhausting the JS heap (the OpenLayers Feature pipeline this replaced OOM'd
    on groups this size).
  - The annotation overlay matches a committed screenshot baseline (clipped to
    the map viewport so the memory footer / sidebar never affect the diff).
  - Hiding a group frees the overlay.

## Data source

By default the app is built with `public/config/e2e.js`, which points at the
**public NCI Imaging Data Commons proxy** — no local DICOM server required. The
default study is `TCGA-02-0001` (a glioblastoma WSI with a large "Nuclei"
POLYGON group).

Override the target without editing code:

- `E2E_STUDY_UID` — study to open
- `E2E_GROUP_NAME` — annotation group name to toggle (default `Nuclei`)
- `E2E_BASE_URL` — point at an already-running server instead of letting
  Playwright serve the build (e.g. a local dcm4chee-backed deployment)

### Fully local / hermetic data (optional)

For a network-independent run you can host the study yourself (e.g. a local
`dcm4chee` via the
[imaging-data-commons-skill](https://github.com/ImagingDataCommons/imaging-data-commons-skill)
to fetch the study, then upload to your DICOMweb server), copy
`public/config/e2e.js` to point `url` at it, and run the suite normally. This
avoids proxy rate limits but is heavier to set up and is not used in CI.

## Running locally

```bash
# 1. Build once with the e2e config and serve it (or use the dev server:
#    PORT=3977 REACT_APP_CONFIG=e2e pnpm start).
pnpm run build:e2e && pnpm run serve:e2e     # terminal A
# 2. Run the tests (reuses the running server).
pnpm run test:e2e                            # terminal B
```

`serve:e2e` is a tiny dependency-free SPA static server
(`scripts/serve-e2e.mjs`) that listens on port **3977** (chosen so it never
collides with other common `:3000` dev servers). Playwright can also start it
itself via the `webServer` config when nothing is listening on that port.

## Screenshot baselines

WebGL output is made deterministic across machines by forcing ANGLE +
SwiftShader (software rendering). SwiftShader still differs between operating
systems, so **baselines are per-OS** and the ones committed here are **Linux**,
matching CI.

Regenerate them with the pinned Playwright container (browser runs in the
container; the app is served from the host):

```bash
pnpm run build:e2e && pnpm run serve:e2e     # terminal A
pnpm run test:e2e:update:docker              # terminal B
# review the diff under e2e/__screenshots__/ and commit
```

Generating baselines with a plain `pnpm run test:e2e:update` on macOS/Windows
produces host-OS snapshots that will **not** match CI — always use the Docker
script for committed baselines.

## CI

`.github/workflows/e2e-visual.yml` runs this suite inside the same pinned
Playwright container, so the browser environment is byte-for-byte identical to
the local baseline-generation path above.

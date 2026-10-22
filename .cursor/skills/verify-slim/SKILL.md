---
name: verify-slim
description: Launch the Slim slide microscopy viewer (React SPA in this repo) against real public DICOM data, drive it headlessly through user journeys (worklist, slide viewing, SEG/ANN/SR overlays, DICOM tag browser, ROI drawing) with Playwright, and capture screenshot, video, and network evidence. Use when you need to prove a Slim change works in the running app, reproduce a viewer bug, or check a feature end to end in the browser.
---

# Verify Slim

Slim is a client-only React app (Vite) that reads everything from a DICOMweb server. Verification runs the repo's real Vite dev server on its own port. It points at the IDC public read-only DICOMweb proxy, which serves real slides, SEG, ANN, and SR objects with CORS for any `localhost` port. No Docker, credentials, or seed data are needed.

All helpers live in `.cursor/skills/verify-slim/scripts/` and are executable. Run them from the repo root.

| Path | Holds | Survives cleanup |
| --- | --- | --- |
| `/tmp/slim-verify/run-<port>/` | pgid, port, DICOMweb URL, `dev-server.log` | no |
| `public/config/verify.js` | generated app config (gitignored by `public/config/*`) | no |
| `/tmp/slim-verify/evidence/<timestamp>-<journey>/` | proof artifacts | yes |
| `~/.cache/slim-verify/harness/` | pinned Playwright install, outside the repo | yes |

## One-time harness setup

```bash
.cursor/skills/verify-slim/scripts/setup-harness.sh
```

This installs Playwright into `~/.cache/slim-verify/harness` and makes sure Chromium exists in Playwright's per-user cache. Prefer the harness over the repo's Playwright so agent runs stay isolated from `pnpm test:e2e`.

Agent sandboxes set `PLAYWRIGHT_BROWSERS_PATH` to a throwaway temp dir. Both `setup-harness.sh` and `drive.mjs` override it to the stable per-user cache. Run them with full permissions (network plus writes outside the workspace).

## Launch

```bash
pnpm install                                   # only if node_modules is missing
.cursor/skills/verify-slim/scripts/launch.sh   # SLIM_VERIFY_PORT=3100 by default
```

`launch.sh` does the following:

- Refuses to start if this skill already runs an instance on the port, or if any other process holds the port.
- Writes `public/config/verify.js`. That config points at the IDC proxy with `write: false`, keeps the worklist, annotation tools, and server selection enabled, and has no OIDC.
- Starts `pnpm exec ./scripts/set-git-env.sh vite --port <port> --strictPort` with `BROWSER=none` and `REACT_APP_CONFIG=verify`.
- Blocks until the log shows Vite ready (`Local:` / `ready in`) and `/config/verify.js` is served. It exits 1 and prints the log tail on startup failure, an early exit, or after 300 seconds.

A cold start takes about 20 seconds. Ready means the bundle compiled and the config is served. Doctor's CORS check plus the `worklist` journey prove the data path.

Options:

- `launch.sh --fresh-cache` wipes `node_modules/.cache/default-development` first, as `pnpm start` does. Use it when verifying a freshly linked or rebuilt `dicom-microscopy-viewer`. Don't use it while the user's own dev server is running, since they share that cache.
- `SLIM_VERIFY_DICOMWEB_URL=<url>` points at another DICOMweb server. Set `SLIM_VERIFY_WRITE=true` only for a writable archive you own, such as the repo's `docker compose` dcm4chee at `http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs`. That archive starts empty, so the built-in journeys' UIDs won't exist there.

Isolation: instances on different ports can run side by side, including next to the user's own `pnpm start` on 3000. They share `public/config/verify.js`, so concurrent instances must use the same DICOMweb URL. They also rewrite `public/config/env.js`, which holds identical content unless `.env` changed in between. Each journey uses a fresh browser context, so `localStorage` state such as `slim_selected_server` never leaks between runs.

## Doctor

```bash
.cursor/skills/verify-slim/scripts/doctor.sh   # exit 0 = worth driving
```

This check is read-only. It confirms the following:

- The recorded process group is alive.
- The port's listener belongs to that group, not someone else's server.
- Vite has reported ready. A source edit that breaks the build shows up here.
- `index.html` loads and `config/verify.js` points at the expected server.
- The DICOMweb server answers QIDO with CORS for this origin.

It also prints the Slim HEAD and the `dicom-microscopy-viewer` version, and says whether DMV is linked. Run it first whenever anything looks off. If it fails, read `/tmp/slim-verify/run-<port>/dev-server.log` before relaunching.

## Drive

```bash
node .cursor/skills/verify-slim/scripts/drive.mjs list
node .cursor/skills/verify-slim/scripts/drive.mjs <journey> [--port 3100] [--headed]
```

| Journey | Proves | Typical time |
| --- | --- | --- |
| `worklist` | Studies list from QIDO, Patient ID filter, row click opens viewer | 10s |
| `slide` | Tiles load and render, wheel zoom fetches higher-res tiles, slide list switches series | 20s |
| `segmentation` | SEG deep link loads referenced slide, show/hide-all hides and restores overlays, fractional legend | 25s |
| `annotation-groups` | ANN bulk data loads, polygons render when zoomed, group switch hides them | 50s |
| `sr-annotations` | SR deep link lists its ROIs in the Annotations panel | 10s |
| `tag-browser` | Header tag browser opens, search narrows to PatientID with its value | 10s |
| `draw-roi` | Alt+D, pick finding and geometry, draw polygon, ROI listed with finding | 20s |

Each journey exits 0 only if every check passes, and prints one PASS or FAIL line per check. The feature map in `features/` explains each journey from the user's side, including manual steps for sub-features no journey covers yet.

To drive something new, add a journey function to `drive.mjs`. Register it in `journeys`, then run it until it passes for the right reason. Selectors that hold up in this codebase:

- **Header buttons** have only hover tooltips. Target their antd icon labels, for example `.ant-layout-header button:has([aria-label="file-search"])`. Other labels: `unordered-list` (worklist), `info`, `api` (select server), `bug` (debug), `setting`.
- **Right and left panel sections** are antd `Menu.SubMenu`s titled `Patient`, `Study`, `Clinical Trial`, `Specimens`, `Equipment`, `Optical Paths`, `Annotations`, `Annotation Groups`, `Segmentations`, and `Parametric Maps`. Use `sidebarSection(page, title)`. Overlay sections start collapsed, so open them with `expandSection()` the way a user clicks the title.
- **Main viewport**: no class or ARIA hook exists, so use `mainViewportBox()`, which picks the largest `.ol-viewport`. Thumbnails and the overview map are also `.ol-viewport`.
- **Annotation tools** have keyboard shortcuts that fire on keyup with Alt: `Alt+D` draw, `M` modify, `T` translate, `R` remove, `V` show/hide, `S` save, `G` go to. Click inside the viewport first so focus is on the page.
- **Worklist**: `.slim-worklist .ant-table-row`, column filters via `th:has-text("Patient ID") .ant-table-filter-trigger`, and a dropdown input with placeholder `Search`.
- **ANN groups** are buttons with `aria-label="Annotation group <label>"`.

The interactive alternative is the `cursor-ide-browser` MCP pointed at `http://localhost:<port>`. It's good for exploring, but it leaves no evidence directory, so the scripted journey stays the proof.

## Evidence

Each run writes `/tmp/slim-verify/evidence/<ISO timestamp>-<journey>/`:

- `NN-<label>.png`: numbered screenshots of the state before and after each action (1600x900)
- `video.webm`: the whole session
- `result.json`: pass/fail per check with measured values, duration, DICOMweb error count, uncaught page errors
- `dicomweb.jsonl`: every response from the DICOMweb server's origin (`url`, `status`, `method`)
- `console.log`: the browser console, including Slim and DMV logs

Proof standards for this app:

- **Use the real user path.** Navigate by URL, click, wheel, and use keyboard shortcuts. Don't call `volumeViewer` methods, React state setters, or `window.config` from the page.
- **Prove what the user sees with viewport pixels.** Check luminance standard deviation for "not blank" and the mean difference between two screenshots for "changed". Always crop to `mainViewportBox()`. Whole-page buffers differ whenever the sidebar scrolls, which once made a broken hide check pass.
- **Prove side effects with traffic.** Use `dicomweb.jsonl` for QIDO queries with the expected filter, WADO-RS frames, and bulk data with HTTP 200. Record by origin, because the IDC proxy serves BulkDataURIs from a sibling `/bulk/...` path, not under the configured `/dicomWeb` prefix.
- **Treat console lines as wait signals only.** Lines such as `add n=507871 annotations` tell you when to act. They never count as proof.
- **Don't fake the server.** The default server is a production DICOMweb endpoint. Don't mock it or route around it.

When you report a verification, link the evidence directory and embed the before and after screenshots.

## Cleanup

```bash
.cursor/skills/verify-slim/scripts/cleanup.sh   # same SLIM_VERIFY_PORT as launch
```

Cleanup works in four steps:

1. It sends SIGTERM to the recorded process group, then SIGKILL after 10 seconds. That group holds pnpm, craco, and webpack. It never kills by process name, so the user's own dev server is safe.
2. It removes `/tmp/slim-verify/run-<port>/`.
3. It removes `public/config/verify.js` once no other verification instance remains.
4. It warns if the port is still held.

Evidence and the harness stay. Run cleanup after failed iterations too.

# Slide viewing

The viewer shows a whole slide image with pan and zoom. Patient, study, and clinical trial metadata sit on the left, along with a thumbnail list of the study's slides. Specimen, equipment, and optical path details sit on the right.

## Sub-features

- `slide-deeplink` opens `/studies/<study>/series/<series>` directly (`slide`).
- `slide-render` fetches WADO-RS frames and paints tissue in the main viewport (`slide`).
- `slide-zoom` wheel-zooms and fetches higher-resolution tiles (`slide`).
- `slide-switch` selects another slide from the left list and updates the URL (`slide`).
- `slide-metadata` shows patient, study, specimen, and equipment panels (no journey yet; visible in `slide` screenshots).
- `slide-overview` shows the overview minimap in the lower left (no journey yet).
- `slide-study-only` opens `/studies/<study>` and routes to its first slide (covered by `worklist` open).

## How to get to it (user POV)

- Click a study in the worklist.
- Paste a deep link, as IDC portal links do.
- Click a slide card in the left `Slides` list.

## Driving it with drive.mjs

Preconditions:

- `doctor.sh` passes.
- The H&E study `2.25.211094631316408413440371843585977094852` exists on the proxy.

- **Open.** Navigate to the H&E deep link. Run `node scripts/drive.mjs slide`. `.ol-viewport` appears, at least one `/frames/` response returns 200, and the viewport's luminance standard deviation exceeds 10. A blank canvas scores about 0; tissue scores about 39.
- **Zoom.** Hover the viewport center and wheel up 6 times. At least 5 new frame responses arrive, with about 25-30 typical, and the viewport differs from the fitted view by a mean of more than 5 (about 65 typical).
- **Switch.** Click the second slide card title (`.ant-layout-sider .ant-card-head-title`). The URL's series UID changes and a new slide renders.
- **Proof.** Look for `01-slide-fit.png`, `02-slide-zoomed.png`, `03-other-slide.png`, and `video.webm`, plus frame counts in `result.json`.

## Gotchas

- The fitted view of this slide needs only 1-2 tiles from the lowest pyramid level. Don't wait for many frames before zooming.
- Headless Chromium renders WebGL tiles only with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`). Without those flags the viewport stays blank, a harness failure that looks like an app bug.
- Thumbnails and the overview map are also `.ol-viewport`. Always pick the largest.
- Slide card order follows the server's series order, so assert that the URL changed rather than a specific label.

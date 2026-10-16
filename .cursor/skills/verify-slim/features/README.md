# Slim verification map

This directory is the maintained source for verifying Slim's user-facing behavior. Read this index before driving the app. Then use the matching feature file as the recipe, and the matching `drive.mjs` journey as the executable proof.

## Baseline preconditions

- Install the harness once with `scripts/setup-harness.sh`.
- Launch with `scripts/launch.sh`. Slim serves on `http://localhost:3100` with `REACT_APP_CONFIG=verify`.
- The default DICOMweb server is the IDC public proxy. It's read-only and needs no sign-in.
- `scripts/doctor.sh` exits 0 before any journey runs.
- Drive only the instance this run launched. Never drive the user's own `pnpm start` on port 3000.

## Fixture data (IDC public proxy)

| Name | StudyInstanceUID | SeriesInstanceUID | Contents |
| --- | --- | --- | --- |
| H&E study | `2.25.211094631316408413440371843585977094852` | `1.3.6.1.4.1.5962.99.1.208792987.352384958.1640886332827.2.0` | 6 SM slides of patient `C3L-00965` (CPTAC-LSCC) |
| SEG/ANN study | `2.25.312916405820155829215771528638931942827` | SEG `1.2.826.0.1.3680043.10.511.3.11534436557194942782874737859569974` | 4 slides of `TCGA-AF-2689`, 4 SEG series (binary and fractional TIL maps, nuclei) |
| | same study | ANN `1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515` | One `Nuclei` group, ~508k polygons |
| SR study | `2.25.266314239954879564284639768519696615904` | SR `1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843` | 9 manual region ROIs, plus an AI tissue SEG |

The `DATA` constant in `scripts/drive.mjs` holds the same UIDs. If IDC drops one, journeys fail at the first wait. Find a replacement with QIDO on the proxy, for example `curl "$URL/studies/<uid>/series" -H 'Accept: application/dicom+json'`, and update both places.

## Driving conventions

- Start every recipe from a fresh browser context, which `drive.mjs` does per run. Slim stores server selection, OIDC config, and token grants in `localStorage`.
- Reach features the way a user does: the worklist, a deep link URL, panel clicks, mouse wheel, and documented `Alt+<key>` shortcuts.
- Prefer stable handles. Use antd icon `aria-label`s in the header, panel titles, `aria-label="Annotation group <name>"`, and input placeholders. Use the largest `.ol-viewport` for the slide.
- Wait on observable state: rows, sections, switches, network responses, and documented log lines for long loads. Add a fixed sleep only after the state is reached, to let WebGL paint.

## Proof and skip reporting

- Pair every user action with screenshots of the before and after state, cropped comparisons of the viewport pixels, and the matching DICOMweb traffic in `dicomweb.jsonl`.
- Prove overlays (SEG, ANN, ROI) with a viewport pixel change. A switch's checked state alone isn't proof.
- A sub-feature without a journey is unverified until you drive it. Never report it as covered by a neighboring journey.
- If fixture data lacks a precondition, report the journey as failed and record why in that feature's Gotchas. Don't weaken the check.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then has exactly four H2 sections, in this order:

1. `Sub-features`: short IDs, one line each, with the covering journey or `(no journey yet)`.
2. `How to get to it (user POV)`: every user entry point.
3. `Driving it with drive.mjs`: starts with `Preconditions:`, then labeled bullets pairing each action with the harness call and the observable result.
4. `Gotchas`: traps that waste or invalidate a run.

## Features

- [Study worklist](./worklist.md) covers listing, column filters, pagination, and opening a study.
- [Slide viewing](./slide-viewing.md) covers deep links, tile rendering, zoom, and switching slides.
- [Derived data overlays](./derived-data-overlays.md) covers SEG, ANN annotation groups, and SR ROIs from deep links and panels.
- [DICOM tag browser](./dicom-tag-browser.md) covers opening the header dialog and searching tags.
- [ROI annotation](./roi-annotation.md) covers drawing, listing, and the unverified save path.

Not mapped yet: the server selection dialog (`api` icon), app info (`info`), debug panel (`bug`), settings drawer (`setting`), presentation states, parametric maps, optical path controls for multiplexed fluorescence, and the go-to-position dialog (`Alt+G`).

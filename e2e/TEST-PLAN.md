# Slim test plan

A click-through checklist for the Slim v2 redesign. Every link opens a public IDC slide, so you don't need a login or local data.

Steps marked **e2e** also run in Playwright (`pnpm test:e2e`). The test name starts with the same ID, so `pnpm test:e2e -g S2` runs one step. Steps marked **manual** need your eyes.

## Setup

```sh
pnpm install
REACT_APP_CONFIG=e2e pnpm start
```

Open http://localhost:3000. The `e2e` config points at the read-only IDC proxy and defines three findings for drawing: Tissue, Tumor (with a histological grade) and Invasive tumor border.

To compare with what's in production, swap `http://localhost:3000` for `https://viewer.imaging.datacommons.cancer.gov/slim` in any link below.

To run the automated tests:

```sh
pnpm exec playwright install chromium   # once
pnpm test:e2e                           # all tests, about 6 minutes
pnpm test:e2e:ui                        # watch them run
```

On GitHub, add the `run-e2e` label to a pull request to run the suite there. It never runs on its own, so the public IDC servers aren't hit on every push.

D9 needs the writable docker-compose archive (not the IDC proxy):

```sh
docker compose up -d --build
pnpm seed:local-archive          # STOW one SM series from IDC into dcm4chee
pnpm test:e2e:local-archive      # Playwright against http://localhost:8008
```

## Studies

These are **feature fixtures** for interactive checks. The IDC sample matrix used for cross-tier screenshot galleries (huge WSI, mixed transfer syntax, CyCIF, CATCH, and so on) lives in [`fedorov/idc-webapp-testing`](https://github.com/fedorov/idc-webapp-testing/blob/main/idc-viewer-test-samples.md). A few series below are shared with that gallery (P9, P11, P15).

| Name | What it covers | Link |
| --- | --- | --- |
| H&E | 6 brightfield slides, label and overview images | [study](http://localhost:3000/studies/2.25.211094631316408413440371843585977094852) |
| TIL maps | Fractional SEG, nuclei SEG and ANN (~500k polygons) | [nuclei SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.11534436557194942782874737859569974) · [fractional SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.44304577929953804027133272057932075) · [nuclei ANN](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515) |
| Binary TIL | Binary TIL SEG (gallery P11) | [binary SEG](http://localhost:3000/studies/2.25.62992225306345560076014492175754966026/series/1.2.826.0.1.3680043.10.511.3.83696154008696806253659241324786415) |
| Parametric map | Aggressiveness score map, ICC profile | [parametric map](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.2.826.0.1.3680043.10.511.3.75366725734262349592517155782982171) · [DX1 slide](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.3.6.1.4.1.5962.99.1.1127304153.1690914100.1637509876697.2.0) |
| SR ROIs | 9 manual ROIs, fractional 4-segment SEG (JPEG-LS lossless), lossless JPEG 2000 slide | [SR](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904/series/1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843) · [study](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904) |
| Multiplexed | 28-channel IMC, 9 presentation states | [IMC slide](http://localhost:3000/studies/2.25.289188443974026654725116153923555879592/series/1.3.6.1.4.1.5962.99.1.1997905734.514527437.1655560347462.4.0) |
| Advanced Blending PR | CyCIF study; PR series deep-link (gallery P9) | [PR series](http://localhost:3000/studies/2.25.219049900737444567890964056686598614067/series/1.2.826.0.1.3680043.10.511.3.89195067478721359204133769511555576) |
| Bone marrow | Rectangle ANN, 47 groups on the slide | [ANN](http://localhost:3000/studies/1.2.826.0.1.3680043.8.498.68164890741340078452950522749989442436/series/1.2.826.0.1.3680043.10.511.3.32704286069299586301112252202253953) |
| CATCH ANN | Manual multi-group tissue regions (gallery P15) | [ANN](http://localhost:3000/studies/2.25.254291509001065670401884248884211292605/series/1.2.826.0.1.3680043.10.511.3.81784194830928094232699134273951295) |
| JPEG 2000 | Lossy JPEG 2000 tiles | [slide](http://localhost:3000/studies/2.25.114227083156133646516769539915340013624/series/1.3.6.1.4.1.5962.99.1.2903380917.963766137.1639285953461.2.0) |

## Worklist

Open http://localhost:3000.

- [ ] **W1** e2e. The table shows 20 rows, a study count and "Showing 1–20 of …".
- [ ] **W2** e2e. Typing a visible patient ID in the search box narrows the rows.
- [ ] **W3** e2e. Searching `C3L-00965` finds the H&E patient, even though IDC's first 100 studies don't include it. The search also asks the server, so try `TCGA-AF-2689` and `HTA12_3` too.
- [ ] **W4** e2e. Clicking the Patient ID header sorts the rows. Click again to reverse.
- [ ] **W5** e2e. Next and Previous move between pages. Rows per page 50 shows 50 rows.
- [ ] **W6** e2e. The Modality column fills in with `SM` (and `ANN`, `SEG`, `SR` where present) within a few seconds. IDC doesn't return study modalities, so Slim asks for the series of the rows on screen only: 20 requests per page, none when you come back to a page.
- [ ] **W7** e2e. Contains → Bulk annotations adds a chip and `?contains=ann` to the URL, and narrows the list. Clearing the chip restores it.
- [ ] **W8** e2e. Clicking a row opens the viewer. The Worklist link in the header brings you back.
- [ ] **W9** e2e. Compact rows (Preferences) tightens the table.
- [ ] **W10** e2e. Contains → Parametric map and Advanced blending list studies. Segmentation and 3D SR annotations page through the server ("Searching the server for Segmentation… page 2"); IDC holds thousands of those series, so the test doesn't wait for the end.
- [ ] **W11** e2e. Rows start newest first by Study date. After sorting by Patient ID, clicking Study date sorts oldest first.
- [ ] **W12** e2e. A search with no match says "No studies match …".
- [ ] **W13** e2e. Tab to a study link and press Enter to open the viewer.

## Header and preferences

Open the [H&E study](http://localhost:3000/studies/2.25.211094631316408413440371843585977094852).

- [ ] **H1** e2e. The tag browser opens, lists the slide's attributes and filters on `PatientID`.
- [ ] **H2** e2e. The tag browser button is gone on the worklist.
- [ ] **H3** e2e. The server dialog rejects `not a url`, and Escape closes it without changing servers.
- [ ] **H4** e2e. The Debug dialog opens and lists session messages.
- [ ] **H5** e2e. Preferences → Light switches the theme and it survives a reload.
- [ ] **H6** e2e. Turning off the overview map in Preferences removes it from the viewer.
- [ ] **H7** e2e. The user menu opens Keyboard shortcuts, Configuration and About Slim.
- [ ] **H8** e2e. Connect to a custom server and see its studies. The choice survives a reload. Playwright serves a made-up URL from IDC; by hand, try `http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs` from `docker compose up`.
- [ ] **H9** e2e. The Scale and position, Slide name and Zoom controls switches hide those viewer overlays.
- [ ] **H10** e2e. Annotations → stroke color and width apply to new ROIs drawn in the default style (a Go to marker). Configured findings keep their own style.
- [ ] **H11** e2e. With Confirm before removing off, Remove deletes an ROI without a dialog.
- [ ] **H12** e2e. System follows the operating system's light or dark setting.
- [ ] **H13** e2e. Search configuration filters the settings list.
- [ ] **H14** e2e. Copy for support ticket copies the Slim version, commit and user agent.
- [ ] **H15** e2e. The tag browser expands and collapses sequences, steps through instances and switches series.

## Slide viewer

Open the [H&E study](http://localhost:3000/studies/2.25.211094631316408413440371843585977094852).

- [ ] **V1** e2e. The study link redirects to its first slide and tissue renders.
- [ ] **V2** e2e. Zoom in loads sharper tiles. Fit to view goes back.
- [ ] **V3** e2e. The scale bar, magnification and cursor position (`x … · y … mm`) update as you move.
- [ ] **V4** e2e. Clicking another slide in the slide list opens it and updates the URL.
- [ ] **V5** e2e. The left panel shows patient, study and clinical trial details.
- [ ] **V6** e2e. The right panel shows the label image, specimen and equipment.
- [ ] **V7** e2e. Both side panels collapse and reopen.
- [ ] **V8** e2e. The footer shows "Tiles X / Y" and memory, and never says "failed".
- [ ] **V9** e2e. A wrong study UID or series UID shows an error page, not a blank screen.
- [ ] **V10** e2e. The [lossy JPEG 2000 slide](http://localhost:3000/studies/2.25.114227083156133646516769539915340013624/series/1.3.6.1.4.1.5962.99.1.2903380917.963766137.1639285953461.2.0) renders.
- [ ] **V11** e2e. Every study in the table loads without page errors or failed tiles.
- [ ] **V12** manual. Dragging pans the slide. Clicking the overview map jumps there.
- [ ] **V13** manual. Below 720px wide, the toolbar compacts into a menu.
- [ ] **V14** e2e. The [lossless JPEG 2000 slide](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904/series/1.3.6.1.4.1.5962.99.1.3501356587.1328342165.1687128569387.4.0) renders.
- [ ] **V15** e2e. Switching slides drops the previous slide's ROIs and segmentations, and Draw is no longer active.
- [ ] **V16** e2e. Open a study from the worklist and switch slides. Back returns to the worklist, and Forward restores the last slide.

## Channels and display options

Open the [IMC slide](http://localhost:3000/studies/2.25.289188443974026654725116153923555879592/series/1.3.6.1.4.1.5962.99.1.1997905734.514527437.1655560347462.4.0).

- [ ] **O1** e2e. Optical paths lists 28 channels. Moving the SMA limit sliders and toggling SMA changes the image.
- [ ] **O2** e2e. Removing SMA and adding it back with Add optical path works.
- [ ] **O3** e2e. Picking a presentation state adds `?state=` and recolors the slide. Reset clears it.
- [ ] **O4** e2e. Reloading with `?state=` in the URL keeps that state.
- [ ] **O5** e2e. On the [DX1 slide](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.3.6.1.4.1.5962.99.1.1127304153.1690914100.1637509876697.2.0), Display options → ICC profiles shifts the colors.
- [ ] **O6** e2e. On the [bone marrow ANN](http://localhost:3000/studies/1.2.826.0.1.3680043.8.498.68164890741340078452950522749989442436/series/1.2.826.0.1.3680043.10.511.3.32704286069299586301112252202253953), the clustering threshold accepts `0.0005`.
- [ ] **O7** e2e. Channel color and opacity change the image.
- [ ] **O8** e2e. On the [parametric map](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.2.826.0.1.3680043.10.511.3.75366725734262349592517155782982171), Display options → Gamma correction changes the overlay. It applies to palette colors (maps and binary segments), not to channels.
- [ ] **O9** e2e. Switching from one presentation state to another updates `?state=` and the image.
- [ ] **O10** e2e. An unknown `?state=` in the URL shows the slide with the Default display.
- [ ] **O11** e2e. The [Advanced Blending PR series](http://localhost:3000/studies/2.25.219049900737444567890964056686598614067/series/1.2.826.0.1.3680043.10.511.3.89195067478721359204133769511555576) (gallery P9) opens the referenced CyCIF slide with optical paths and presentation states. Applying that PR from the series URL is still a TODO (same as master); use O3/O4 to apply a state from the picker.

## Segmentations and parametric maps

- [ ] **S1** e2e. The [fractional SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.44304577929953804027133272057932075) link opens the slide with only that segment on ("1 of 5 visible", the Fractional TILs Present row). The [nuclei SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.11534436557194942782874737859569974) link does the same for Nuclei (manual).
- [ ] **S2** e2e. On the [SR study](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904), Show all segments gives "4 of 4" and Hide all gives "0 of 4".
- [ ] **S3** e2e. Toggling STROMA and moving its opacity slider changes the overlay.
- [ ] **S4** e2e. The Series dropdown switches between segmentation series.
- [ ] **S5** e2e. On the nuclei SEG, segment details open, segment color changes the overlay and Segment interpolation toggles.
- [ ] **S6** e2e. The [binary TIL SEG](http://localhost:3000/studies/2.25.62992225306345560076014492175754966026/series/1.2.826.0.1.3680043.10.511.3.83696154008696806253659241324786415) (gallery P11) opens the slide with that binary segment visible.
- [ ] **P1** e2e. On the [parametric map](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.2.826.0.1.3680043.10.511.3.75366725734262349592517155782982171), the map shows and hides.
- [ ] **P2** e2e. Parametric map opacity changes the overlay and interpolation toggles.

## Bulk annotations

- [ ] **A1** e2e. The [nuclei ANN](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515) draws polygons once you zoom in, and its toggle hides them. Loading takes 20–30 seconds.
- [ ] **A2** e2e. The [bone marrow ANN](http://localhost:3000/studies/1.2.826.0.1.3680043.8.498.68164890741340078452950522749989442436/series/1.2.826.0.1.3680043.10.511.3.32704286069299586301112252202253953) opens with "5 of 47 visible". Show all gives "47 of 47", Hide all gives "0 of 47".
- [ ] **A3** e2e. On the bone marrow ANN, group color and fill change the drawing.
- [ ] **A4** manual. Color by measurement recolors the shapes, and measurement names with a hyphen (LOINC codes) display in full. No IDC ANN series has measurements, so this needs your own data. The picker itself has unit tests (`AnnotationGroupItem.test.tsx`).
- [ ] **A5** e2e. Clicking a group's name zooms to that group.
- [ ] **A6** e2e. The [CATCH multi-group tissue ANN](http://localhost:3000/studies/2.25.254291509001065670401884248884211292605/series/1.2.826.0.1.3680043.10.511.3.81784194830928094232699134273951295) (gallery P15) loads with more than one group already on; Hide all then Show all cover every group.

## SR ROIs

Open the [SR series](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904/series/1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843).

- [ ] **R1** e2e. The Annotations section lists 9 ROIs, including Necrosis.
- [ ] **R2** e2e. Hide all gives "0 of 9". Hiding one ROI from all shown gives "8 of 9".
- [ ] **R3** e2e. Turning off the Necrosis category hides its 4 ROIs ("5 of 9 visible").
- [ ] **R4** manual. Clicking or hovering an SR ROI shows its details. D10–D13 cover the same for drawn ROIs.

## Drawing ROIs

Open the [H&E study](http://localhost:3000/studies/2.25.211094631316408413440371843585977094852).

- [ ] **D1** e2e. Draw → Tumor, Polygon, G2 → Start drawing. Click 4 points and back on the first. "ROI 1 … Tumor" appears.
- [ ] **D2** e2e. Reopening Draw keeps Tumor and the grade you picked.
- [ ] **D3** e2e. Invasive tumor border offers only Line and Line (freehand). Tumor offers all 7 geometry types.
- [ ] **D4** e2e. Draw a point. Alt+V hides ROIs. Remove deletes it after you confirm.
- [ ] **D5** e2e. Go to rejects bad coordinates and centers the view on valid ones.
- [ ] **D6** e2e. Save opens the Save annotations dialog with your ROIs. Confirming shows an "Annotations could not be saved." toast, because the IDC proxy is read-only.
- [ ] **D7** e2e. Each geometry type draws: point, line, freehand line, polygon, freehand polygon, rectangle, ellipse.
- [ ] **D8** e2e. Alt+M modifies and Alt+T moves an ROI. The Measure option shows length or area. Esc cancels drawing.
- [ ] **D10** e2e. Clicking an ROI on the slide selects it, Shift-click adds a second one, and clicking empty space clears the selection.
- [ ] **D11** e2e. Double-clicking an ROI opens its details with the finding and evaluation.
- [ ] **D12** e2e. Hovering an ROI shows a tooltip with its name and finding.
- [ ] **D13** e2e. Clicking an ROI in the Annotations list selects it and highlights it on the slide.
- [ ] **D9** e2e (local archive). `docker compose up -d --build`, `pnpm seed:local-archive`, then `pnpm test:e2e:local-archive`. Draw, Save, reload and see the ROIs come back as an SR on http://localhost:8008.

## Configuration

Playwright changes these settings per test on top of `public/config/e2e.js`.

- [ ] **C1** e2e. `disableWorklist: true` hides the worklist and the Worklist link.
- [ ] **C2** e2e. `disableAnnotationTools: true` hides Draw, Save and the other ROI tools, and their shortcuts do nothing. Go to (Alt+G) still works.
- [ ] **C3** manual, optional. An OIDC server config signs in, shows your name in the user menu and signs out.
- [ ] **C4** e2e. A Google Cloud route (`/projects/<project>/locations/<location>/datasets/<dataset>/dicomStores/<store>/study/<study>`) opens a slide from that store. Playwright serves a made-up Healthcare API URL from IDC.
- [ ] **C5** e2e. `mode: 'light'` starts in the light theme.
- [ ] **C6** e2e. `messages.disabled: ['success']` silences success toasts; warnings still show.
- [ ] **C7** e2e. `organization` and a custom `logo.svg` show in the header, the user menu and About.

## Errors

Playwright fakes these failures by answering requests with 404.

- [ ] **E1** e2e. Failed tiles show as "N failed" in the footer and in the Debug dialog.
- [ ] **E2** e2e. A failed worklist search shows "Search for studies failed."
- [ ] **E3** e2e. A study that fails to load shows "Couldn't load this study". Retry loads it.
- [ ] **E4** e2e. A render error shows "Something went wrong" with Reload, not a blank screen.
- [ ] **E5** e2e. High memory use shows in the footer, and Debug lists a critical memory warning.

## Accessibility

[axe](https://github.com/dequelabs/axe-core) checks WCAG 2.1 A and AA rules.

- [ ] **X1** e2e. The worklist, dark theme.
- [ ] **X2** e2e. The viewer, dark theme.
- [ ] **X3** e2e. The Preferences dialog, dark theme.
- [ ] **X4** e2e. The viewer, light theme.
- [ ] **X5** e2e. The worklist, light theme.

## Not covered by IDC data

IDC v25 slide studies hold no examples of these, so neither this plan nor Playwright can check them:

- **Slides in HTJ2K, JPEG-LS or JPEG XL.** IDC slides use uncompressed, JPEG baseline and JPEG 2000 (lossy and lossless) tiles only. The RMS fractional SEG is JPEG-LS lossless (S2, S3), which exercises that decoder.
- **ANN measurements** (see A4).
- **Label map SEG.**
- **Comprehensive SR (not 3D).** Every IDC slide SR is Comprehensive 3D SR.
- **Grayscale, Color and Pseudocolor Softcopy presentation states.** Every IDC slide PR is an Advanced Blending presentation state, which is the only kind Slim applies, and only on monochrome slides. Opening a link to any other presentation state series, or to a Comprehensive SR, shows the referenced slide and nothing else.

## Known issues

Found while writing this plan.

Fixed on this branch:

- **Worklist search only covered loaded studies.** IDC returns at most 100 studies, so most patients were unreachable. The search now also queries the server by Patient ID, Patient Name, Accession Number and Study ID, as the old worklist did (W3).
- **Saving ROIs threw before the dialog opened.** dcmjs rejects every valid `TrackingIdentifier` when building a measurement group, up to its latest release. `patches/dcmjs@0.52.0.patch` fixes the check. Failed saves also show a toast now; before, they only reached the console (D6).
- **The Modality column was slow on IDC.** It sent one series query for each of the 100 loaded studies. It now asks only for the rows on the current page and remembers the answers (W6).
- **The ICC profile switch could stay disabled.** DMV fetches ICC profiles after the viewer is created, and the panel never saw them arrive. It now checks again when the first tile finishes loading. An earlier check on `loading_ended` only ran for bulk annotations (O5).
- **Draw stayed on after switching slides.** The new slide started with the old tool active. Each new viewer now starts in select mode with ROIs shown (V15). `master` had the same flaw.
- **Viewer state carried over on slide switch.** Interpolation toggles, the segmentation series filter and ROI selection are cleared for the new viewer. Closing Go to restores select mode (#461).
- **ROI shortcuts ignored `disableAnnotationTools`.** Alt+D opened Draw with the tools hidden. Only Escape and Go to work now (C2). `master` had the same flaw.
- **An unknown `?state=` left the presentation state picker blank.** It now reads Default (O10).
- **Dark theme contrast failed WCAG AA.** White labels on the blue primary buttons reached 3.5:1, and the selected tab text 3.8:1. Dark primary is lighter (`#6a9cf7`) with dark labels. Light theme muted text on the panel background reached 4.4:1 and is darker now (X3, X4).

Still open:

- **The `verify-slim` skill on this branch** still uses craco and Ant Design selectors. It will be rewritten from scratch separately.
- **Other presentation states in a monochrome study.** The loader reads every PR instance in the study as Advanced Blending. A Grayscale or Pseudocolor presentation state there has no `AdvancedBlendingSequence`, so it would likely show "Presentation State could not be loaded." `master` behaves the same. IDC has no such study to confirm it. Tracked in [#460](https://github.com/ImagingDataCommons/slim/issues/460).

Same as `master`, left as is:

- Opening a SEG, ANN or SR link highlights no slide in the slide list.
- Back after picking a presentation state doesn't undo it.
- The hover tooltip of a drawn ROI says "Unknown Series".
- The memory warning reaches the Debug dialog only, with no toast.
- The tag browser has no copy button.

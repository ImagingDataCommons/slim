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
pnpm test:e2e                           # all tests, about 5 minutes
pnpm test:e2e:ui                        # watch them run
```

## Studies

| Name | What it covers | Link |
| --- | --- | --- |
| H&E | 6 brightfield slides, label and overview images | [study](http://localhost:3000/studies/2.25.211094631316408413440371843585977094852) |
| TIL maps | Binary and fractional SEG, nuclei ANN (~500k polygons) | [nuclei SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.11534436557194942782874737859569974) · [fractional SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.44304577929953804027133272057932075) · [nuclei ANN](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515) |
| Parametric map | Aggressiveness score map, ICC profile | [parametric map](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.2.826.0.1.3680043.10.511.3.75366725734262349592517155782982171) · [DX1 slide](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.3.6.1.4.1.5962.99.1.1127304153.1690914100.1637509876697.2.0) |
| SR ROIs | 9 manual ROIs, fractional 4-segment SEG | [SR](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904/series/1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843) · [study](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904) |
| Multiplexed | 28-channel IMC, 9 presentation states | [IMC slide](http://localhost:3000/studies/2.25.289188443974026654725116153923555879592/series/1.3.6.1.4.1.5962.99.1.1997905734.514527437.1655560347462.4.0) |
| Bone marrow | Rectangle ANN, 47 groups on the slide | [ANN](http://localhost:3000/studies/1.2.826.0.1.3680043.8.498.68164890741340078452950522749989442436/series/1.2.826.0.1.3680043.10.511.3.32704286069299586301112252202253953) |
| JPEG 2000 | JPEG 2000 compressed tiles | [slide](http://localhost:3000/studies/2.25.114227083156133646516769539915340013624/series/1.3.6.1.4.1.5962.99.1.2903380917.963766137.1639285953461.2.0) |

## Worklist

Open http://localhost:3000.

- [ ] **W1** e2e. The table shows 20 rows, a study count and "Showing 1–20 of …".
- [ ] **W2** e2e. Typing a visible patient ID in the search box narrows the rows.
- [ ] **W3** e2e. Searching `C3L-00965` finds the H&E patient, even though IDC's first 100 studies don't include it. The search also asks the server, so try `TCGA-AF-2689` and `HTA12_3` too.
- [ ] **W4** e2e. Clicking the Patient ID header sorts the rows. Click again to reverse.
- [ ] **W5** e2e. Next and Previous move between pages. Rows per page 50 shows 50 rows.
- [ ] **W6** e2e. The Modality column fills in with `SM` (and `ANN`, `SEG`, `SR` where present) after a few seconds.
- [ ] **W7** e2e. Contains → Bulk annotations adds a chip and `?contains=ann` to the URL, and narrows the list. Clearing the chip restores it.
- [ ] **W8** e2e. Clicking a row opens the viewer. The Worklist link in the header brings you back.
- [ ] **W9** manual. Compact rows (Preferences) tightens the table.

## Header and preferences

Open the [H&E study](http://localhost:3000/studies/2.25.211094631316408413440371843585977094852).

- [ ] **H1** e2e. The tag browser opens, lists the slide's attributes and filters on `PatientID`.
- [ ] **H2** e2e. The tag browser button is gone on the worklist.
- [ ] **H3** e2e. The server dialog rejects `not a url`, and Escape closes it without changing servers.
- [ ] **H4** e2e. The Debug dialog opens and lists session messages.
- [ ] **H5** e2e. Preferences → Light switches the theme and it survives a reload. Try System too (manual).
- [ ] **H6** e2e. Turning off the overview map in Preferences removes it from the viewer.
- [ ] **H7** e2e. The user menu opens Keyboard shortcuts, Configuration and About Slim.
- [ ] **H8** manual. Connect to a custom server (for example `http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs` from `docker compose up`) and see its studies.

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
- [ ] **V10** e2e. The [JPEG 2000 slide](http://localhost:3000/studies/2.25.114227083156133646516769539915340013624/series/1.3.6.1.4.1.5962.99.1.2903380917.963766137.1639285953461.2.0) renders.
- [ ] **V11** e2e. Every study in the table loads without page errors or failed tiles.
- [ ] **V12** manual. Dragging pans the slide. Clicking the overview map jumps there.
- [ ] **V13** manual. Below 720px wide, the toolbar compacts into a menu.

## Channels and display options

Open the [IMC slide](http://localhost:3000/studies/2.25.289188443974026654725116153923555879592/series/1.3.6.1.4.1.5962.99.1.1997905734.514527437.1655560347462.4.0).

- [ ] **O1** e2e. Optical paths lists 28 channels. Moving the SMA limit sliders and toggling SMA changes the image.
- [ ] **O2** e2e. Removing SMA and adding it back with Add optical path works.
- [ ] **O3** e2e. Picking a presentation state adds `?state=` and recolors the slide. Reset clears it.
- [ ] **O4** e2e. Reloading with `?state=` in the URL keeps that state.
- [ ] **O5** e2e. On the [DX1 slide](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.3.6.1.4.1.5962.99.1.1127304153.1690914100.1637509876697.2.0), Display options → ICC profiles shifts the colors.
- [ ] **O6** e2e. On the [bone marrow ANN](http://localhost:3000/studies/1.2.826.0.1.3680043.8.498.68164890741340078452950522749989442436/series/1.2.826.0.1.3680043.10.511.3.32704286069299586301112252202253953), the clustering threshold accepts `0.0005`.
- [ ] **O7** manual. Channel color and opacity change the image.
- [ ] **O8** manual. Gamma correction and interpolation toggles change the image.

## Segmentations and parametric maps

- [ ] **S1** e2e. The [fractional SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.44304577929953804027133272057932075) link opens the slide with only that segment on ("1 of 5 visible", the Fractional TILs Present row). The [nuclei SEG](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.11534436557194942782874737859569974) link does the same for Nuclei (manual).
- [ ] **S2** e2e. On the [SR study](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904), Show all segments gives "4 of 4" and Hide all gives "0 of 4".
- [ ] **S3** e2e. Toggling STROMA and moving its opacity slider changes the overlay.
- [ ] **S4** e2e. The Series dropdown switches between segmentation series.
- [ ] **S5** manual. Segment color, details popover and Segment interpolation work.
- [ ] **P1** e2e. On the [parametric map](http://localhost:3000/studies/2.25.169142599340531625361659178384453215494/series/1.2.826.0.1.3680043.10.511.3.75366725734262349592517155782982171), the map shows and hides.
- [ ] **P2** manual. Parametric map opacity, colormap and interpolation work.

## Bulk annotations

- [ ] **A1** e2e. The [nuclei ANN](http://localhost:3000/studies/2.25.312916405820155829215771528638931942827/series/1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515) draws polygons once you zoom in, and its toggle hides them. Loading takes 20–30 seconds.
- [ ] **A2** e2e. The [bone marrow ANN](http://localhost:3000/studies/1.2.826.0.1.3680043.8.498.68164890741340078452950522749989442436/series/1.2.826.0.1.3680043.10.511.3.32704286069299586301112252202253953) opens with "5 of 47 visible". Show all gives "47 of 47", Hide all gives "0 of 47".
- [ ] **A3** manual. Group color, fill and outline change the drawing.
- [ ] **A4** manual. Color by measurement recolors the shapes, and measurement names with a hyphen (LOINC codes) display in full.
- [ ] **A5** manual. Zoom to group frames that group.

## SR ROIs

Open the [SR series](http://localhost:3000/studies/2.25.266314239954879564284639768519696615904/series/1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843).

- [ ] **R1** e2e. The Annotations section lists 9 ROIs, including Necrosis.
- [ ] **R2** e2e. Hide all gives "0 of 9". Hiding one ROI from all shown gives "8 of 9".
- [ ] **R3** e2e. Turning off the Necrosis category hides its 4 ROIs ("5 of 9 visible").
- [ ] **R4** manual. Clicking or hovering an ROI shows its details.

## Drawing ROIs

Open the [H&E study](http://localhost:3000/studies/2.25.211094631316408413440371843585977094852).

- [ ] **D1** e2e. Draw → Tumor, Polygon, G2 → Start drawing. Click 4 points and back on the first. "ROI 1 … Tumor" appears.
- [ ] **D2** e2e. Reopening Draw keeps Tumor and the grade you picked.
- [ ] **D3** e2e. Invasive tumor border offers only Line and Line (freehand). Tumor offers all 7 geometry types.
- [ ] **D4** e2e. Draw a point. Alt+V hides ROIs. Remove deletes it after you confirm.
- [ ] **D5** e2e. Go to rejects bad coordinates and centers the view on valid ones.
- [ ] **D6** e2e. Save opens the Save annotations dialog with your ROIs. Confirming shows an "Annotations could not be saved." toast, because the IDC proxy is read-only.
- [ ] **D7** manual. Each geometry type draws: point, line, freehand line, polygon, freehand polygon, rectangle, ellipse.
- [ ] **D8** manual. Alt+M modifies and Alt+T moves an ROI. The Measure option shows length or area. Esc cancels drawing.
- [ ] **D9** manual. Start the local archive with `docker compose up -d` (see the README's local deployment section) and store a slide in it. Open it at http://localhost:8008, draw ROIs, Save, reload and see them come back as an SR.

## Configuration

- [ ] **C1** manual. `disableWorklist: true` hides the worklist and the Worklist link.
- [ ] **C2** manual. `disableAnnotationTools: true` hides Draw, Save and the other ROI tools.
- [ ] **C3** manual, optional. An OIDC server config signs in, shows your name in the user menu and signs out.
- [ ] **C4** manual, optional. A Google Cloud route (`/projects/<project>/locations/<location>/datasets/<dataset>/dicomStores/<store>/studies/<study>`) opens a slide.

## Known issues

Found while writing this plan.

Fixed on this branch:

- **Worklist search only covered loaded studies.** IDC returns at most 100 studies, so most patients were unreachable. The search now also queries the server by Patient ID, Patient Name, Accession Number and Study ID, as the old worklist did (W3).
- **Saving ROIs threw before the dialog opened.** dcmjs rejects every valid `TrackingIdentifier` when building a measurement group, up to its latest release. `patches/dcmjs@0.52.0.patch` fixes the check. Failed saves also show a toast now; before, they only reached the console (D6).

Still open:

- **The Modality column is slow on IDC.** It fills in through one series query per study, about 100 requests.
- **The `verify-slim` skill on this branch** still uses craco and Ant Design selectors and won't work with v2.

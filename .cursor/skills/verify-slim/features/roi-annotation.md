# ROI annotation

Users draw region of interest annotations on a slide. They pick a configured finding and geometry, draw on the viewport, review the ROIs in the Annotations panel, and save them as a DICOM Comprehensive 3D SR.

## Sub-features

- `roi-configure` opens `Configure annotations` with Alt+D or the toolbar draw button, then picks finding and geometry (`draw-roi`).
- `roi-draw-polygon` clicks vertices and closes on the first point, so the ROI appears in `Annotations` (`draw-roi`).
- `roi-finding` labels the ROI with the selected finding (`draw-roi`).
- `roi-other-geometries` covers point, circle, box, line, and freehand (no journey yet).
- `roi-modify-translate-remove` covers Alt+M, Alt+T, and Alt+R on a selected ROI (no journey yet).
- `roi-visibility` toggles all ROIs with Alt+V (no journey yet).
- `roi-save` uses Alt+S, `Verify and save report`, and a STOW-RS store of an SR (no journey yet; needs a writable server).

## How to get to it (user POV)

- On a slide, press `Alt+D` or click the first toolbar button (tooltip `Draw ROI [Alt+D]`).
- Choose a finding in `Select finding`, a geometry in `Select geometry type`, and click `Select`.

## Driving it with drive.mjs

Preconditions:

- `doctor.sh` passes.
- The verify config's `annotations` list includes `Tissue` and `Tumor`, each with `polygon` and `freehandpolygon`.

- **Configure.** Load the H&E deep link, click inside the viewport, and press `Alt+D`. Run `node scripts/drive.mjs draw-roi`. The `Configure annotations` modal opens. Choose `Tissue` and `Polygon`, then `Select`. The modal closes and the draw tool is active.
- **Draw.** Click 4 corners of a 240x160 rectangle around the viewport center, then click the first corner again. A polygon outline stays on the slide.
- **Review.** The `Annotations` section lists exactly one `ROI 1`, whose text includes `Tissue`.
- **Proof.** Look for `01-roi-configured.png` and `02-roi-drawn.png`, plus `video.webm` for the drawing itself.

## Gotchas

- Shortcuts fire on keyup with Alt held and are bound to `document.body`. Focus must be on the page, not inside a modal input.
- The default verification server is read-only (`write: false`), so `roi-save` can't succeed against it. To verify saving, run the repo's `docker compose up -d` (dcm4chee on 8008) and store a slide there with `dicomweb_client ... store instances`. Then launch with `SLIM_VERIFY_DICOMWEB_URL=http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs SLIM_VERIFY_WRITE=true`, draw, press `Alt+S`, confirm, and prove the stored SR with a QIDO `series?Modality=SR` query. None of this has been run yet.
- A freshly drawn ROI renders selected (blue), not in the finding's configured style color.

# Derived data overlays

Slim overlays image analysis results on the slide. DICOM Segmentations (SEG) appear as raster masks, Microscopy Bulk Simple Annotations (ANN) as vector annotation groups, and Comprehensive 3D SR documents as ROI lists. Opening a derived series URL loads its referenced slide and turns that object on.

## Sub-features

- `seg-deeplink` opens a SEG series URL, resolves the referenced slide, and shows the mask (`segmentation`).
- `seg-toggle` hides and shows segments with the Segmentations panel switches (`segmentation`).
- `seg-legend` shows the in-viewport color legend for a visible fractional SEG (`segmentation`).
- `seg-series-select` filters segments by SEG series via `All Series (N segments)` (no journey yet).
- `seg-zoom-to` clicks a segment label to zoom to its bounding box (no journey yet).
- `ann-deeplink` opens an ANN series URL and switches its group on (`annotation-groups`).
- `ann-render` loads bulk graphic data and draws nucleus polygons when zoomed in (`annotation-groups`).
- `ann-toggle` hides a group with its switch (`annotation-groups`).
- `sr-deeplink` opens an SR series URL and lists its ROIs in the Annotations panel (`sr-annotations`).
- `sr-toggle` hides individual SR ROIs (no journey yet).
- `pm-overlay` shows parametric maps (no journey yet; no fixture identified).

## How to get to it (user POV)

- Paste a derived series deep link: `/studies/<study>/series/<SEG|ANN|SR series>`.
- Open a slide that has derived data, then expand `Segmentations`, `Annotation Groups`, or `Annotations` in the right panel.

## Driving it with drive.mjs

Preconditions:

- `doctor.sh` passes.
- The SEG/ANN study and the SR study from the README fixture table exist on the proxy.

- **SEG open.** Navigate to the SEG deep link. Run `node scripts/drive.mjs segmentation`. The `Segmentations` section exists, and after expanding it two switches are checked: show-all and the URL's segment. Yellow nuclei dots cover the tissue.
- **SEG hide.** Click the first checked switch, which is show-all. Every switch turns off and the viewport changes by a mean above 0.5 (about 1.7 typical).
- **SEG show all.** Click show-all again. All 6 switches are on, the viewport changes by about 10 against the hidden state, and the `Legend` box appears for the fractional TIL map.
- **ANN open.** Navigate to the ANN deep link. Run `node scripts/drive.mjs annotation-groups`. `Annotation Groups` lists `Annotation group Nuclei` with its switch on. `dicomweb.jsonl` holds a 200 for `/bulkdata/006A0002/...`, the AnnotationGroupSequence bulk data.
- **ANN render.** After the console logs `add n=507871 annotations`, wheel-zoom 8 steps into the center. Yellow nucleus outlines trace the cells.
- **ANN hide.** Click the group's switch. The outlines disappear, with a viewport mean diff of about 14.
- **SR open.** Navigate to the SR deep link. Run `node scripts/drive.mjs sr-annotations`. The `Annotations` section lists `ROI 1` through `ROI 9`.
- **Proof.** Check the screenshots `segmentation-on`, `segmentation-off`, `segmentation-all-on`, `annotation-groups-zoomed`, `annotation-groups-hidden`, and `sr-annotations`, plus bulk data rows in `dicomweb.jsonl`.

## Gotchas

- `Segmentations` and `Annotation Groups` start collapsed. Their switches exist in the DOM but are hidden until the title is clicked.
- The first switch in each overlay section controls the whole section, not one item.
- The IDC proxy serves BulkDataURIs from `https://proxy.imaging.datacommons.cancer.gov/bulk/...`, outside the configured `/dicomWeb` prefix. Filter network evidence by origin.
- ANN timing: all ~508k annotations load about 20s after open. In two runs, zooming and toggling the group before that left numbered cluster markers on screen after the switch went off (viewport diff 0.0). The journey now waits for the full load. Recheck this race if you touch annotation group visibility or DMV's progressive loading.
- At the fitted zoom, SEG nuclei masks move the viewport mean by only 1-2 levels. Thresholds above that flake.

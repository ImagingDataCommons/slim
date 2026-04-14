# viv

Isolated port of [viv-dicomweb-test](https://github.com/jmuhlich/viv-dicomweb-test) (DICOMweb + [Viv](https://github.com/hms-dbmi/viv) + [dicom-microscopy-viewer](https://github.com/imagingdatacommons/dicom-microscopy-viewer)).

Use the **`/viv/...` routes** (e.g. `/viv/studies/:studyInstanceUID/...`) for the Viv + Deck.gl slide viewer; optional `vivSettings` in `public/config/*.js` applies there.

## Local `dicom-microscopy-viewer` (e.g. bulk annotation API)

From the DMV repo: `bun link`. From `slim/`: `bun link dicom-microscopy-viewer`, then `bun install` if needed. The semver entry in `package.json` stays as-is; the link overrides resolution while you develop. Use `bun unlink dicom-microscopy-viewer` in slim when you want registry tarballs again.

## Limitations (v1)

- 16-bit SM images only; uses private `opticalPaths` access on `VolumeImageViewer`.
- **Microscopy Bulk Simple Annotations** are drawn via Deck.gl (`PathLayer` / `ScatterplotLayer`) using the same decode path as OpenLayers (`dmv.bulkSimpleAnnotations`, `dmv.annotation.fetchGraphicData`). All instances for matching `ReferencedSeriesSequence` load at once (no pan-based reload yet). No TID1500 SR, SEG, optical-path sidebar, or presentation states in Viv.
- Intended as a rendering experiment alongside the default `SlideViewer`.

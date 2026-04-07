# viv

Isolated port of [viv-dicomweb-test](https://github.com/jmuhlich/viv-dicomweb-test) (DICOMweb + [Viv](https://github.com/hms-dbmi/viv) + [dicom-microscopy-viewer](https://github.com/imagingdatacommons/dicom-microscopy-viewer)).

Enable with `useViv: true` in `public/config/*.js` (see `viv_example.js`).

## Limitations (v1)

- 16-bit SM images only; uses private `opticalPaths` access on `VolumeImageViewer`.
- No Slim annotations, SEG/SR, bulk annotations, optical-path sidebar, or presentation states.
- Intended as a rendering experiment alongside the default `SlideViewer`.

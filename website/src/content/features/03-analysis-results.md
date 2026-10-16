---
title: AI and analysis results as overlays
eyebrow: Raster results
summary: Overlay segmentations, label maps and parametric maps from image analysis pipelines, with legends and per-segment controls.
order: 3
icon: Layers
screenshot: segmentation
example: seg-fractional
bullets:
  - Binary and fractional DICOM Segmentation, including TILED_SPARSE at non-standard resolutions
  - Labelmap Segmentation (Supplement 243) with one segment per pixel value
  - Parametric Maps for saliency, attention and class activation maps
  - Show All / Hide All for parametric maps; in-viewport color legend with click-to-zoom
---

Fractional segmentations and parametric maps show a collapsible color legend in the viewport whenever an overlay is visible. Its per-item toggles stay in sync with the switches in the right-hand panel, opacity is set per segment, and the Parametric Maps panel can show or hide every map at once.

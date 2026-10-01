---
title: Draw, measure and save as DICOM
eyebrow: Annotation tools
summary: Create region-of-interest annotations with coded findings and store them back to the archive as DICOM Comprehensive 3D SR.
order: 4
icon: PenTool
screenshot: draw
example: sr
bullets:
  - Draw, Modify, Translate, Remove, Hide, Save and Go to from one centered tool pill
  - Points, lines, boxes, circles, polygons and freehand lines or polygons
  - Findings coded in SNOMED CT or any terminology your deployment configures
  - Stored as SCOORD3D in millimeters (TID 1500 and TID 1410) via DICOMweb STOW-RS
---

The tool pill compacts on narrow screens, and the Draw dialog keeps its fields when you close and reopen it. Saved annotations are ordinary DICOM SR instances, so other DICOM-aware tools such as [highdicom](https://github.com/ImagingDataCommons/highdicom) can read them back for analysis. Saving needs a server configured with `write: true`; the public demo is read-only.

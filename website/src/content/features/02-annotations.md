---
title: Annotations at the scale of single cells
eyebrow: Vector annotations
summary: Display ROI annotations from DICOM Comprehensive 3D SR and millions of cell outlines from Microscopy Bulk Simple Annotations.
order: 2
icon: Shapes
screenshot: annotations
example: ann
bullets:
  - Comprehensive 3D SR, TID 1500 measurement reports with TID 1410 planar ROIs
  - Microscopy Bulk Simple Annotations, grouped by label, with show/hide per group
  - Annotation groups and categories with counts and partial visibility states
  - Selecting a derived object in the URL loads its slide and turns it on
---

Annotations are DICOM objects too. Slim reads them from the same DICOMweb server as the images, matches them to the slide they reference, and lists them in the right-hand panel under Annotations, Annotation groups and Annotation categories.
